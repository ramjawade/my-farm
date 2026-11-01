import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { SeasonReport } from './report.service';

/** Total sales, total expenses, net so far and crops sold for the selected season. */
@Component({
  selector: 'app-season-summary',
  imports: [TranslatePipe, LocalNumberPipe, ReferenceNamePipe],
  template: `
    <section class="card p-3" data-testid="season-summary">
      <h2 class="h6 d-flex justify-content-between align-items-baseline">
        {{ 'reports.seasonSummary' | translate }}
        <small class="text-body-secondary fw-normal">
          {{ report().season | referenceName: 'season' }} {{ report().year }}
        </small>
      </h2>
      <div class="row row-cols-2 row-cols-md-4 g-3 text-center">
        <div class="col">
          <strong class="d-block">₹{{ report().totalSales | localNumber: '1.0-0' }}</strong>
          <small class="text-body-secondary">{{ 'reports.totalSales' | translate }}</small>
        </div>
        <div class="col">
          <strong class="d-block">₹{{ report().totalExpense | localNumber: '1.0-0' }}</strong>
          <small class="text-body-secondary">{{ 'reports.totalExpenses' | translate }}</small>
        </div>
        <div class="col">
          <strong class="d-block" data-testid="net" [class]="netTone()">
            {{ report().net < 0 ? '−' : '+' }}₹{{ abs(report().net) | localNumber: '1.0-0' }}
          </strong>
          <small class="text-body-secondary">{{ 'reports.netSoFar' | translate }}</small>
        </div>
        <div class="col">
          <strong class="d-block">
            {{
              'reports.cropsSoldValue'
                | translate: { sold: report().cropsSold, total: report().crops.length }
            }}
          </strong>
          <small class="text-body-secondary">{{ 'reports.cropsSold' | translate }}</small>
        </div>
      </div>
      <p class="small text-body-secondary mt-3 mb-0">{{ 'reports.netHint' | translate }}</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonSummaryComponent {
  readonly report = input.required<SeasonReport>();

  protected readonly abs = Math.abs;
  protected readonly netTone = computed(() =>
    this.report().net < 0 ? 'text-danger' : 'text-success',
  );
}
