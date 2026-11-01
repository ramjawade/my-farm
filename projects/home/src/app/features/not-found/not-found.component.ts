import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** The page for an address the app does not know: the empty card with one way back. */
@Component({
  selector: 'app-not-found',
  imports: [TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mf-page-container">
      <div class="card">
        <div class="empty-state">
          <span class="empty-state__icon" aria-hidden="true"><i class="bi bi-map"></i></span>
          <div>
            <h1 class="empty-state__title">{{ 'notFound.title' | translate }}</h1>
            <p class="empty-state__text">{{ 'notFound.text' | translate }}</p>
            <a routerLink="/" class="btn btn-primary mt-2">{{
              'notFound.backToHome' | translate
            }}</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundComponent {}
