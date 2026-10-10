import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';

import { LanguageService } from './language.service';
import { LocaleService } from './locale.service';
import { LocalDatePipe, LocalNumberPipe } from './localized.pipes';

@Component({
  imports: [LocalDatePipe, LocalNumberPipe],
  template: `<span id="d">{{ date | localDate: 'dd MMM yyyy' }}</span
    ><span id="n">₹{{ amount() | localNumber }}</span>`,
})
class Host {
  date = new Date(2026, 9, 1);
  amount = signal(124500);
}

describe('locale formats', () => {
  let language: LanguageService;
  let locale: LocaleService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    language = TestBed.inject(LanguageService);
    locale = TestBed.inject(LocaleService);
  });

  afterEach(() => localStorage.clear());

  it('names the month in Marathi', () => {
    language.setDeviceLanguage('mr');
    expect(locale.date(new Date(2026, 9, 1), 'dd MMM yyyy')).toBe('01 ऑक्टो 2026');
  });

  it('names the month in Hindi', () => {
    language.setDeviceLanguage('hi');
    expect(locale.date(new Date(2026, 9, 1), 'dd MMM yyyy')).toBe('01 अक्तू॰ 2026');
  });

  it('keeps English dates as they were', () => {
    language.setDeviceLanguage('en');
    expect(locale.date(new Date(2026, 9, 1), 'dd MMM yyyy')).toBe('01 Oct 2026');
  });

  it('groups amounts the Indian way, with Western digits, in every language', () => {
    for (const lang of ['mr', 'hi', 'en'] as const) {
      language.setDeviceLanguage(lang);
      expect(locale.number(124500)).withContext(lang).toBe('1,24,500');
      expect(locale.number(1234567.5, '1.2-2')).withContext(lang).toBe('12,34,567.50');
    }
  });

  it('changes a rendered date and amount the moment the language changes', () => {
    language.setDeviceLanguage('en');
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#d')?.textContent).toBe('01 Oct 2026');
    expect(el.querySelector('#n')?.textContent).toBe('₹1,24,500');

    language.setDeviceLanguage('mr');
    fixture.detectChanges();

    expect(el.querySelector('#d')?.textContent).toBe('01 ऑक्टो 2026');
    expect(el.querySelector('#n')?.textContent).toBe('₹1,24,500');
  });

  it('renders nothing for an empty value', () => {
    const pipe = TestBed.runInInjectionContext(() => new LocalDatePipe());
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform('')).toBeNull();
  });
});
