import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * What a page shows while it loads its content: the empty card with a spinner in place of the
 * icon. Announced as a status; the spinner does not turn when the device asks for less motion.
 */
@Component({
  selector: 'app-page-loading',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="empty-state" role="status" aria-live="polite">
        <span class="empty-state__icon" aria-hidden="true">
          <span
            class="spinner-border text-success"
            style="--bs-spinner-width: 1.5rem; --bs-spinner-height: 1.5rem"
          ></span>
        </span>
        <div>
          <h2 class="empty-state__title">{{ 'states.loading.title' | translate }}</h2>
          <p class="empty-state__text">{{ 'states.loading.text' | translate }}</p>
        </div>
      </div>
    </div>
  `,
})
export class PageLoadingComponent {}
