import { inject, provideAppInitializer } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { LanguageService } from './language.service';

/**
 * Constructs `LanguageService` (its effect keeps the language in step with the
 * farmer and the device) and loads the starting language's strings before the
 * first render, so the app never flashes English before Marathi.
 */
export function provideLanguageInitializer() {
  return provideAppInitializer(() => {
    const translate = inject(TranslateService);
    const language = inject(LanguageService).language();
    return firstValueFrom(translate.use(language));
  });
}
