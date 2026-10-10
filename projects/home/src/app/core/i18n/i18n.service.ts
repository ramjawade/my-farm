import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

/**
 * Translate from TypeScript. `t()` reads a signal that ticks when the language
 * or its strings change, so using it inside a `computed()` re-evaluates on a
 * language switch (plain `translate.instant` would keep the old text).
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly version = signal(0);

  constructor() {
    if (this.translate) {
      merge(this.translate.onLangChange, this.translate.onTranslationChange).subscribe(() =>
        this.version.update((v) => v + 1),
      );
    }
  }

  t(key: string, params?: Record<string, unknown>): string {
    this.version();
    return this.translate ? this.translate.instant(key, params) : key;
  }
}
