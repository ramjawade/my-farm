import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ConnectionService } from '../../core/services/connection.service';

/**
 * Shown at the top of every screen while the device is offline. It is a "problem" banner: it
 * cannot be dismissed and goes away by itself when the connection returns.
 */
@Component({
  selector: 'app-offline-banner',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!connection.online()) {
      <div
        class="d-flex align-items-start gap-3 bg-body border border-danger rounded-3 p-3 mx-3 mt-3"
        role="alert"
        data-testid="offline-banner"
      >
        <span
          class="d-flex align-items-center justify-content-center flex-shrink-0 rounded-3 bg-danger-subtle text-danger"
          style="width: 36px; height: 36px"
          aria-hidden="true"
        >
          <i class="bi bi-wifi-off"></i>
        </span>
        <div class="min-w-0">
          <span class="d-block small fw-bold text-uppercase text-danger">{{
            'states.offline.label' | translate
          }}</span>
          <strong class="d-block">{{ 'states.offline.title' | translate }}</strong>
          <span class="d-block small text-body-secondary">{{
            'states.offline.text' | translate
          }}</span>
        </div>
      </div>
    }
  `,
})
export class OfflineBanner {
  protected readonly connection = inject(ConnectionService);
}
