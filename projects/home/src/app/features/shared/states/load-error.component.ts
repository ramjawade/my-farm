import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * What a page shows when it could not load what it needs. It only asks to try again; the page
 * decides what that means (repeat its own load).
 */
@Component({
  selector: 'app-load-error',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="empty-state" role="alert">
        <span class="empty-state__icon" aria-hidden="true"
          ><i class="bi bi-exclamation-triangle"></i
        ></span>
        <div>
          <h2 class="empty-state__title">{{ 'states.error.title' | translate }}</h2>
          <p class="empty-state__text">{{ 'states.error.text' | translate }}</p>
          <button type="button" class="btn btn-primary mt-2" (click)="retry.emit()">
            {{ 'states.error.retry' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LoadErrorComponent {
  readonly retry = output<void>();
}
