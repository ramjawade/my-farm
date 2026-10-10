import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

export const APP_NAME = 'My Farm';

/**
 * Sets the browser tab title to "<page title> · My Farm". A route's `title` is
 * a translation key; it is translated here and re-applied when the language
 * changes.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private titleKey: string | undefined;

  constructor() {
    super();
    this.translate.onLangChange.subscribe(() => this.apply());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.titleKey = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    this.document.title = this.titleKey
      ? `${this.translate.instant(this.titleKey)} · ${APP_NAME}`
      : APP_NAME;
  }
}
