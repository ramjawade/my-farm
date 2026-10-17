import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { changeDirection } from './prices.utils';

/**
 * A price per quintal with the change since the previous reading: green and up, red and
 * down, or "No change". Shared by the farm rows and the watchlist items, so they read alike.
 */
@Component({
  selector: 'app-price-figure',
  imports: [TranslatePipe, LocalNumberPipe],
  template: `
    <span class="text-end flex-shrink-0">
      <strong class="d-block fs-5">₹{{ price() | localNumber: '1.0-0' }}</strong>
      @switch (direction()) {
        @case ('up') {
          <small class="text-success fw-semibold"
            ><i class="bi bi-caret-up-fill" aria-hidden="true"></i> +{{
              change() | localNumber: '1.1-1'
            }}%</small
          >
        }
        @case ('down') {
          <small class="text-danger fw-semibold"
            ><i class="bi bi-caret-down-fill" aria-hidden="true"></i> −{{
              magnitude() | localNumber: '1.1-1'
            }}%</small
          >
        }
        @case ('flat') {
          <small class="text-body-secondary fw-semibold">{{ 'prices.noChange' | translate }}</small>
        }
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceFigureComponent {
  readonly price = input.required<number>();
  /** Percentage change since the previous reading; null or missing shows no change line. */
  readonly change = input<number | null | undefined>();

  protected readonly direction = computed(() => changeDirection(this.change()));
  protected readonly magnitude = computed(() => Math.abs(this.change() ?? 0));
}
