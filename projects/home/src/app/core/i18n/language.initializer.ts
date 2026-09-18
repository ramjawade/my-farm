import { inject, provideAppInitializer } from '@angular/core';

import { LanguageService } from './language.service';

/**
 * Ensures `LanguageService` is constructed (and its sync effect starts
 * watching `AuthService.currentUser`) before the app renders.
 */
export function provideLanguageInitializer() {
  return provideAppInitializer(() => {
    inject(LanguageService);
  });
}
