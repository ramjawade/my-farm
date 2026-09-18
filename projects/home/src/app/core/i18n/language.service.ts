import { Injectable, inject, effect } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../auth/auth.service';

/**
 * Keeps the active `TranslateService` locale in sync with the logged-in
 * farmer's `preferredLanguage` — switches at runtime, no page reload.
 * One effect, gated on a real precondition (a logged-in user), per the
 * repo's rule against unconditional root-service effects.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);

  constructor() {
    effect(() => {
      const preferredLanguage = this.authService.currentUser()?.preferredLanguage;
      if (preferredLanguage) {
        this.translate.use(preferredLanguage);
      }
    });
  }
}
