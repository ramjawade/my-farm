import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import {
  RegisterOutcome,
  SessionAuthService,
  SessionOutcome,
  SessionResult,
} from '../../core/auth/session-auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';
import { LoginComponent } from './login.component';

const farmer = { id: 7, fullName: 'Rajesh Patil', phone: '9822012345' } as FarmerRegistrationData;
const session: SessionResult = { token: 'tok', farmer };

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let host: HTMLElement;
  let createSession: jasmine.Spy<(phone: string, pin: string) => Promise<SessionOutcome>>;
  let register: jasmine.Spy<(req: { pin: string }) => Promise<RegisterOutcome>>;
  let login: jasmine.Spy;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    jasmine.clock().install();
    createSession = jasmine.createSpy('createSession');
    register = jasmine.createSpy('register');
    login = jasmine.createSpy('login');
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: SessionAuthService, useValue: { createSession, register } },
        { provide: AuthService, useValue: { isLoggedIn: () => false, login } },
        { provide: FarmerRegistrationService, useValue: { upsertFarmer: () => undefined } },
        {
          provide: LanguageService,
          useValue: { language: () => 'en', setDeviceLanguage: () => undefined },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  const key = (id: string) => host.querySelector<HTMLButtonElement>(`[data-testid="key-${id}"]`)!;
  const title = () => host.querySelector('h2')!.textContent!.trim();
  const alertText = () => host.querySelector('[role="alert"]')?.textContent?.trim() ?? '';

  async function tap(...keys: string[]) {
    for (const k of keys) key(k).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const typePhone = () => tap(...'9822012345'.split(''));

  async function toPinStep() {
    await typePhone();
    await tap('ok');
  }

  it('starts on the number step with the pad shown', () => {
    expect(title()).toBe('login.title.phone');
    expect(host.querySelectorAll('.login-digits span:not(.gap)').length).toBe(10);
    expect(key('1')).toBeTruthy();
  });

  it('rejects a short number and shakes the number slots', async () => {
    await tap('9', '8', '2', 'ok');
    expect(alertText()).toBe('login.errPhone');
    expect(host.querySelector('.login-number')!.classList).toContain('login-shake');
    expect(title()).toBe('login.title.phone');
  });

  it('keeps only ten digits', async () => {
    await tap(...'98220123456789'.split(''));
    expect(host.querySelectorAll('.login-digits .empty').length).toBe(0);
    await tap('ok');
    expect(title()).toBe('login.title.pin');
  });

  it('signs an existing farmer in, greets them, then goes to the map', async () => {
    createSession.and.resolveTo({ status: 'ok', result: session });
    await toPinStep();
    await tap('1', '2', '3', '4', 'ok');
    expect(createSession).toHaveBeenCalledWith('9822012345', '1234');
    expect(title()).toBe('login.title.done');
    expect(login).not.toHaveBeenCalled();
    jasmine.clock().tick(1600);
    expect(login).toHaveBeenCalledWith(farmer, 'tok');
    expect(navigate).toHaveBeenCalledWith(['/map']);
  });

  it('accepts a 6-digit PIN for an existing account', async () => {
    createSession.and.resolveTo({ status: 'ok', result: session });
    await toPinStep();
    await tap(...'123456'.split(''), 'ok');
    expect(createSession).toHaveBeenCalledWith('9822012345', '123456');
  });

  it('clears the PIN on a wrong PIN', async () => {
    createSession.and.resolveTo({ status: 'wrong-pin' });
    await toPinStep();
    await tap('1', '2', '3', '4', 'ok');
    expect(alertText()).toBe('login.errWrongPin');
    expect(host.querySelectorAll('.login-pin .on').length).toBe(0);
    expect(title()).toBe('login.title.pin');
  });

  it('shows the locked and unreachable messages', async () => {
    createSession.and.resolveTo({ status: 'locked' });
    await toPinStep();
    await tap('1', '2', '3', '4', 'ok');
    expect(alertText()).toBe('login.errLocked');
    createSession.and.resolveTo({ status: 'unreachable' });
    await tap('1', '2', '3', '4', 'ok');
    expect(alertText()).toBe('login.errUnreachable');
    expect(login).not.toHaveBeenCalled();
  });

  it('Change returns to the number step and clears the PIN', async () => {
    await toPinStep();
    await tap('1', '2');
    host.querySelector<HTMLButtonElement>('.login-sub button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(title()).toBe('login.title.phone');
    await tap('ok');
    expect(host.querySelectorAll('.login-pin .on').length).toBe(0);
  });

  describe('new farmer', () => {
    async function toNameStep() {
      createSession.and.resolveTo({ status: 'no-account' });
      await toPinStep();
      await tap('1', '2', '3', '4', 'ok');
    }

    async function enterName(value: string) {
      const input = host.querySelector<HTMLInputElement>('#nameField')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('asks for a name, a new PIN and a repeat, then registers in the chosen language', async () => {
      register.and.resolveTo({ status: 'ok', result: session });
      await toNameStep();
      expect(title()).toBe('login.title.name');
      await enterName('Rajesh Patil');
      expect(title()).toBe('login.title.create');
      await tap('4', '3', '2', '1', 'ok');
      expect(title()).toBe('login.title.confirm');
      await tap('4', '3', '2', '1', 'ok');
      expect(register).toHaveBeenCalledWith(
        jasmine.objectContaining({
          phone: '9822012345',
          fullName: 'Rajesh Patil',
          pin: '4321',
          preferredLanguage: 'en',
        }),
      );
      expect(title()).toBe('login.title.done');
    });

    it('rejects a name shorter than three characters', async () => {
      await toNameStep();
      await enterName('Ra');
      expect(alertText()).toBe('login.errName');
      expect(title()).toBe('login.title.name');
    });

    it('returns to the new-PIN step when the repeat differs', async () => {
      await toNameStep();
      await enterName('Rajesh Patil');
      await tap('4', '3', '2', '1', 'ok');
      await tap('1', '1', '1', '1', 'ok');
      expect(alertText()).toBe('login.errPinMismatch');
      expect(title()).toBe('login.title.create');
      expect(register).not.toHaveBeenCalled();
    });

    it('limits a new PIN to four digits', async () => {
      await toNameStep();
      await enterName('Rajesh Patil');
      await tap('1', '2', '3', '4', '5', '6');
      expect(host.querySelectorAll('.login-pin > span').length).toBe(4);
    });

    it('goes back to the PIN step when the number was taken meanwhile', async () => {
      register.and.resolveTo({ status: 'phone-taken' });
      await toNameStep();
      await enterName('Rajesh Patil');
      await tap('4', '3', '2', '1', 'ok');
      await tap('4', '3', '2', '1', 'ok');
      expect(title()).toBe('login.title.pin');
      expect(alertText()).toBe('login.errTaken');
    });

    it('never signs in when the server is unreachable at the last step', async () => {
      register.and.resolveTo({ status: 'unreachable' });
      await toNameStep();
      await enterName('Rajesh Patil');
      await tap('4', '3', '2', '1', 'ok');
      await tap('4', '3', '2', '1', 'ok');
      expect(alertText()).toBe('login.errUnreachable');
      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('keyboard', () => {
    function press(keyName: string) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
    }

    it('types digits, deletes with Backspace and moves on with Enter', async () => {
      '9822012345'.split('').forEach(press);
      press('Backspace');
      press('5');
      press('Enter');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(title()).toBe('login.title.pin');
    });

    it('ignores letters', async () => {
      press('a');
      press('Enter');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(alertText()).toBe('login.errPhone');
    });
  });

  it('masks PIN digits and reveals them with Show PIN', async () => {
    await toPinStep();
    await tap('1', '2');
    jasmine.clock().tick(1000);
    fixture.detectChanges();
    const boxes = () =>
      [...host.querySelectorAll('.login-pin > span')].map((b) => b.textContent!.trim());
    expect(boxes()).toEqual(['•', '•', '', '']);
    host.querySelector<HTMLButtonElement>('.login-pin + button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(boxes()).toEqual(['1', '2', '', '']);
  });
});
