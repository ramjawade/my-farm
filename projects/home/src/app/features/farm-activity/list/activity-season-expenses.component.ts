import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { CategorySpend } from './activity-log-summary';

/** This season's spend by category, as a bar per category. */
@Component({
  selector: 'app-activity-season-expenses',
  imports: [TranslatePipe, LocalNumberPipe],
  template: `
    <section class="card">
      <h2 class="fs-6 fw-bold d-flex justify-content-between align-items-center mb-2">
        {{ 'activityLogScreen.seasonExpenses' | translate }}
        <strong>₹{{ total() | localNumber }}</strong>
      </h2>
      @for (row of rows(); track row.name) {
        <div class="mb-2">
          <div class="d-flex justify-content-between">
            <span>{{ row.name }}</span>
            <strong>₹{{ row.amount | localNumber }}</strong>
          </div>
          <div class="progress" style="height: 8px" aria-hidden="true">
            <div class="progress-bar bg-success" [style.width.%]="share(row)"></div>
          </div>
        </div>
      } @empty {
        <p class="text-body-secondary mb-0">
          {{ 'activityLogScreen.noSeasonExpenses' | translate }}
        </p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitySeasonExpensesComponent {
  readonly rows = input<CategorySpend[]>([]);

  readonly total = computed(() => this.rows().reduce((sum, r) => sum + r.amount, 0));

  /** Width of a bar, relative to the biggest category. */
  share(row: CategorySpend): number {
    const max = this.rows()[0]?.amount ?? 0;
    return max ? (row.amount / max) * 100 : 0;
  }
}
