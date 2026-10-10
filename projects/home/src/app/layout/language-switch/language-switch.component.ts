import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AppLanguage } from '../../core/i18n/app-language';
import { LanguageService } from '../../core/i18n/language.service';

/** Each language is labelled in its own script so it can be found without reading the current one. */
const OPTIONS: readonly { value: AppLanguage; label: string }[] = [
  { value: 'mr', label: 'मराठी' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'en', label: 'English' },
];

/** Three-button language switch for the login page; the choice is kept on this device. */
@Component({
  selector: 'app-language-switch',
  imports: [TranslatePipe],
  template: `
    <div class="seg" role="group" [attr.aria-label]="'profile.language' | translate">
      @for (option of options; track option.value) {
        <button
          type="button"
          [attr.lang]="option.value"
          [attr.aria-pressed]="language() === option.value"
          (click)="select(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitchComponent {
  private readonly languageService = inject(LanguageService);

  protected readonly options = OPTIONS;
  protected readonly language = this.languageService.language;

  protected select(language: AppLanguage): void {
    this.languageService.setDeviceLanguage(language);
  }
}
