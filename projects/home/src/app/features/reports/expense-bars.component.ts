import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';

/** One bar of an expense breakdown. `barPercent` is the bar width, `percent` the optional share label. */
export interface ExpenseBar {
  label: string;
  amount: number;
  barPercent: number;
  percent?: number;
}

/** A titled list of amounts with bars: expenses by category, or by month. */
@Component({
  selector: 'app-expense-bars',
  imports: [TranslatePipe, LocalNumberPipe],
  template: `
    <section class="card p-3 h-100">
      <h2 class="h6 d-flex justify-content-between align-items-baseline">
        {{ heading() | translate }}
        <strong>₹{{ total() | localNumber: '1.0-0' }}</strong>
      </h2>
      @for (bar of bars(); track bar.label) {
        <div class="mb-2">
          <div class="d-flex justify-content-between">
            <span>
              {{ bar.label }}
              @if (bar.percent !== undefined) {
                <small class="text-body-secondary">{{ bar.percent | localNumber: '1.0-0' }}%</small>
              }
            </span>
            <span>₹{{ bar.amount | localNumber: '1.0-0' }}</span>
          </div>
          <div class="progress" style="height: 8px" aria-hidden="true">
            <div class="progress-bar bg-success" [style.width.%]="bar.barPercent"></div>
          </div>
        </div>
      } @empty {
        <p class="text-body-secondary mb-0">{{ 'reports.noExpenses' | translate }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseBarsComponent {
  /** Translation key of the heading. */
  readonly heading = input.required<string>();
  readonly bars = input.required<ExpenseBar[]>();
  readonly total = input.required<number>();
}
