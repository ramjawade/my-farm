import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';

import { LANGUAGE_STORAGE_KEY } from '../../core/i18n/app-language';
import { LanguageSwitchComponent } from './language-switch.component';

describe('LanguageSwitchComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
  });

  afterEach(() => localStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(LanguageSwitchComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const buttons = () => Array.from(el.querySelectorAll('button'));
    return { fixture, el, buttons };
  }

  it('offers Marathi, Hindi and English, each in its own script', () => {
    const { buttons } = render();

    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['मराठी', 'हिंदी', 'English']);
    expect(buttons().map((b) => b.getAttribute('lang'))).toEqual(['mr', 'hi', 'en']);
  });

  it('starts with Marathi selected and announces it as pressed', () => {
    const { buttons } = render();

    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('switches at once and saves the choice on the device', () => {
    const { fixture, buttons } = render();

    buttons()[1].click();
    fixture.detectChanges();

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('hi');
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('is operable from the keyboard (real buttons in a labelled group)', () => {
    const { el, buttons } = render();

    expect(el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBeTruthy();
    expect(buttons().every((b) => b.type === 'button')).toBeTrue();
  });
});
