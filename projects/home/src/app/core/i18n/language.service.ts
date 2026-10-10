import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';
import { AppLanguage, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, asAppLanguage } from './app-language';

function readDeviceLanguage(): AppLanguage | null {
  try {
    return asAppLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeDeviceLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
}

/**
 * The app language: the signed-in farmer's saved language, else the language
 * chosen on this device, else Marathi. Applies it at runtime (no reload) to
 * `TranslateService` and to `<html lang>`, and keeps the device choice in step
 * with the signed-in farmer's, so the login page after sign-out matches.
 * One DOM/storage-only effect; it makes no requests.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  private readonly device = signal<AppLanguage | null>(readDeviceLanguage());
  private readonly profile = computed(() =>
    asAppLanguage(this.authService.currentUser()?.preferredLanguage),
  );

  /** The language in effect now. */
  readonly language = computed<AppLanguage>(
    () => this.profile() ?? this.device() ?? DEFAULT_LANGUAGE,
  );

  constructor() {
    effect(() => {
      const language = this.language();
      this.translate.use(language);
      this.document.documentElement.lang = language;
      if (this.profile()) {
        this.persist(language);
      }
    });
  }

  /** Choose the language on this device (the login switch). */
  setDeviceLanguage(language: AppLanguage): void {
    this.persist(language);
  }

  private persist(language: AppLanguage): void {
    if (this.device() !== language) {
      this.device.set(language);
      writeDeviceLanguage(language);
    }
  }
}
