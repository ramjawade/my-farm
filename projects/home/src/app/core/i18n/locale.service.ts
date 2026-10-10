import { formatDate, formatNumber, registerLocaleData } from '@angular/common';
import localeEnIn from '@angular/common/locales/en-IN';
import localeHi from '@angular/common/locales/hi';
import localeMr from '@angular/common/locales/mr';
import { Injectable, computed, inject } from '@angular/core';

import { AppLanguage } from './app-language';
import { LanguageService } from './language.service';

registerLocaleData(localeMr, 'mr');
registerLocaleData(localeHi, 'hi');
registerLocaleData(localeEnIn, 'en-IN');

const LOCALES: Record<AppLanguage, string> = { mr: 'mr', hi: 'hi', en: 'en-IN' };

/**
 * Date and number formats for the active language: native month and day names,
 * Indian digit grouping (1,24,500) in all three, Western digits (0-9) always.
 * Reads the language signal, so callers in templates update on a switch.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly language = inject(LanguageService).language;

  readonly locale = computed(() => LOCALES[this.language()]);

  date(value: Date | string | number, format: string): string {
    return formatDate(value, format, this.locale());
  }

  number(value: number | string, digitsInfo?: string): string {
    return formatNumber(Number(value), this.locale(), digitsInfo);
  }
}
