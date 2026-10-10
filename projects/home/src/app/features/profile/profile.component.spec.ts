import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { LandsApiService } from '../../core/api/lands-api.service';
import { FarmerProfileApiService } from '../../core/api/farmer-profile-api.service';
import { FakeFarmerProfileApiService } from '../../testing/fake-farmer-profile-api.service';
import { FakeLandsApiService } from '../../testing/fake-lands-api.service';
import { profileControlError } from './profile.fields';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let authService: AuthService;
  let profileApi: FakeFarmerProfileApiService;

  const mockUser: FarmerRegistrationData = {
    id: 1,
    fullName: 'Test Farmer Name',
    phone: '1122334455',
    email: 'test@example.com',
    preferredLanguage: 'en',
    userRole: 'Farmer',
    farmName: 'Green Acres',
    farmArea: 5.5,
    farmAreaUnit: 'acres',
    primaryCrops: [],
    waterSource: '',
    irrigationType: '',
    farmingMethod: '',
    locationType: 'manual',
    state: 'Maharashtra',
    district: 'Pune',
    village: 'Mulshi',
    pincode: '411057',
    location: null,
    createdAt: Date.now(),
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button.list-group-item'));
  const rowFor = (labelKey: string) => rows().find((b) => b.textContent?.includes(labelKey))!;
  const dialog = () => el().querySelector('form[role="dialog"]');
  const type = (id: string, value: string) => {
    const input = el().querySelector<HTMLInputElement>('#' + id)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = async () => {
    el().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function setup(user: FarmerRegistrationData = mockUser): Promise<void> {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: LandsApiService, useClass: FakeLandsApiService },
        { provide: FarmerProfileApiService, useClass: FakeFarmerProfileApiService },
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        AuthService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    profileApi = TestBed.inject(FarmerProfileApiService) as unknown as FakeFarmerProfileApiService;
    authService.login(user);
    fixture.detectChanges();
  }

  describe('with a complete profile', () => {
    beforeEach(() => setup());

    it('shows the header and the stored values', () => {
      expect(el().querySelector('h1')?.textContent).toContain('Test Farmer Name');
      expect(el().textContent).toContain('1122334455');
      expect(el().textContent).toContain('test@example.com');
      expect(el().textContent).toContain('Mulshi');
      expect(el().textContent).toContain('Pune, Maharashtra');
      expect(el().textContent).toContain('411057');
    });

    it('shows no banner and no farm or farming rows', () => {
      expect(el().querySelector('.alert-warning')).toBeNull();
      const text = el().textContent ?? '';
      for (const gone of [
        'Green Acres',
        'farmName',
        'waterSource',
        'primaryCrops',
        'profile.resetAgronomic',
      ]) {
        expect(text).not.toContain(gone);
      }
      expect(el().querySelectorAll('.btn-outline-danger').length).toBe(1);
    });

    it('shows the phone as a read-only row', () => {
      expect(rows().some((b) => b.textContent?.includes('profile.phoneNumber'))).toBeFalse();
      expect(el().textContent).toContain('profile.phoneNumber');
    });

    it('opens one field in a dialog and closes it with Cancel', () => {
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      expect(dialog()).not.toBeNull();
      expect(el().querySelectorAll('form[role="dialog"] input').length).toBe(1);

      el().querySelector<HTMLButtonElement>('form[role="dialog"] button[type="button"]')!.click();
      fixture.detectChanges();
      expect(dialog()).toBeNull();
    });

    it('closes the dialog with Escape without saving', () => {
      const update = spyOn(authService, 'updateProfile');
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(dialog()).toBeNull();
      expect(update).not.toHaveBeenCalled();
    });

    it('saves an edited email and shows it', async () => {
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      type('pf-email', 'new@farm.in');
      await submit();

      expect(dialog()).toBeNull();
      expect(authService.currentUser()?.email).toBe('new@farm.in');
      expect(el().textContent).toContain('new@farm.in');
    });

    it('saves district and state together', async () => {
      rowFor('profile.districtState').click();
      fixture.detectChanges();
      type('pf-district', 'Nashik');
      type('pf-state', 'MH');
      await submit();

      expect(authService.currentUser()?.district).toBe('Nashik');
      expect(authService.currentUser()?.state).toBe('MH');
    });

    it('keeps the dialog open and shows the error for an invalid pincode', async () => {
      const update = spyOn(authService, 'updateProfile');
      rowFor('profile.pincode').click();
      fixture.detectChanges();
      type('pf-pincode', '12345');
      await submit();

      expect(dialog()).not.toBeNull();
      expect(el().textContent).toContain('profile.errors.pincodeInvalid');
      expect(update).not.toHaveBeenCalled();
    });

    it('keeps the dialog and the entered value when the save fails', async () => {
      spyOn(authService, 'updateProfile').and.rejectWith(new Error('offline'));
      spyOn(console, 'error');
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      type('pf-email', 'new@farm.in');
      await submit();

      expect(dialog()).not.toBeNull();
      expect(el().querySelector<HTMLInputElement>('#pf-email')!.value).toBe('new@farm.in');
      expect(el().querySelector('.alert-danger')).not.toBeNull();
    });

    it('does not start a second save while one is running', async () => {
      let release!: () => void;
      const update = spyOn(authService, 'updateProfile').and.returnValue(
        new Promise<void>((resolve) => (release = resolve)),
      );
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      type('pf-email', 'new@farm.in');
      el().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      el().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      expect(update).toHaveBeenCalledTimes(1);
      release();
      await fixture.whenStable();
    });

    it('applies the language straight away and stores it on the farmer', async () => {
      rowFor('profile.language').click();
      fixture.detectChanges();
      const select = el().querySelector<HTMLSelectElement>('#pf-preferredLanguage')!;
      select.value = 'mr';
      select.dispatchEvent(new Event('change'));
      await submit();

      expect(authService.currentUser()?.preferredLanguage).toBe('mr');
    });

    it('applies the theme from its dialog', async () => {
      rowFor('profile.theme').click();
      fixture.detectChanges();
      const select = el().querySelector<HTMLSelectElement>('#pf-theme')!;
      select.value = 'dark';
      select.dispatchEvent(new Event('change'));
      await submit();

      expect(localStorage.getItem('my_farm_theme')).toBe('dark');
      document.documentElement.removeAttribute('data-bs-theme');
    });

    it('signs the farmer out from the Sign out button', () => {
      const logout = spyOn(authService, 'logout');
      el().querySelector<HTMLButtonElement>('button.btn-outline-danger')!.click();
      expect(logout).toHaveBeenCalled();
    });
  });

  describe('with details missing', () => {
    beforeEach(() => setup({ ...mockUser, email: '', pincode: '' }));

    it('shows "Add" on empty rows', () => {
      expect(rowFor('profile.emailAddress').textContent).toContain('profile.add');
      expect(rowFor('profile.pincode').textContent).toContain('profile.add');
    });

    it('counts the missing details and opens the first one from the banner', () => {
      const banner = el().querySelector('.alert-warning')!;
      expect(banner.textContent).toContain('profile.nudge.many');
      banner.querySelector<HTMLButtonElement>('button')!.click();
      fixture.detectChanges();
      expect(el().querySelector('#pf-email')).not.toBeNull();
    });

    it('drops the banner once everything is filled in', async () => {
      rowFor('profile.emailAddress').click();
      fixture.detectChanges();
      type('pf-email', 'a@b.co');
      await submit();
      rowFor('profile.pincode').click();
      fixture.detectChanges();
      type('pf-pincode', '422103');
      await submit();

      expect(el().querySelector('.alert-warning')).toBeNull();
      expect(profileApi).toBeTruthy();
    });
  });
});

describe('profileControlError', () => {
  const control = (name: 'fullName' | 'email' | 'pincode', required = false) =>
    ({ name, kind: 'text', labelKey: '', required }) as const;

  it('requires a name', () => {
    expect(profileControlError(control('fullName', true), '  ')).toBe(
      'profile.errors.nameRequired',
    );
    expect(profileControlError(control('fullName', true), 'Ram')).toBe('');
  });

  it('accepts an empty or well-formed email only', () => {
    expect(profileControlError(control('email'), '')).toBe('');
    expect(profileControlError(control('email'), 'a@b.co')).toBe('');
    expect(profileControlError(control('email'), 'nope')).toBe('profile.errors.emailInvalid');
  });

  it('accepts an empty or six-digit pincode only', () => {
    expect(profileControlError(control('pincode'), '')).toBe('');
    expect(profileControlError(control('pincode'), '422103')).toBe('');
    expect(profileControlError(control('pincode'), '4221')).toBe('profile.errors.pincodeInvalid');
    expect(profileControlError(control('pincode'), '42210a')).toBe('profile.errors.pincodeInvalid');
  });
});
