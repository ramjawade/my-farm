import { inject, provideAppInitializer } from '@angular/core';

import { ThemeService } from './theme.service';

/**
 * Ensures `ThemeService` is constructed (and its sync effect and device
 * listeners start) before the app renders, on every route including login.
 */
export function provideThemeInitializer() {
  return provideAppInitializer(() => {
    inject(ThemeService);
  });
}
