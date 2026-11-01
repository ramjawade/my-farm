import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { resolveReferenceName } from '../../core/i18n/reference-name';
import { Season, seasonForDate } from '../../core/models/season';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';
import { CompareSeasonsComponent } from './compare-seasons.component';
import { CropProfitListComponent } from './crop-profit-list.component';
import { ExpenseBar, ExpenseBarsComponent } from './expense-bars.component';
import { ReportService } from './report.service';
import { SeasonFilterComponent } from './season-filter.component';
import { SeasonSummaryComponent } from './season-summary.component';

/** Reports: the selected season's sales, expenses and profit, plus Compare seasons. */
@Component({
  selector: 'app-reports',
  imports: [
    TranslatePipe,
    SeasonFilterComponent,
    SeasonSummaryComponent,
    CropProfitListComponent,
    ExpenseBarsComponent,
    CompareSeasonsComponent,
  ],
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly workflowService = inject(WorkflowStateService);

  readonly selectedSeason = signal<Season>(seasonForDate());
  readonly selectedYear = signal(new Date().getFullYear());

  /** The current year and the two before it. */
  readonly years = computed(() => {
    const year = new Date().getFullYear();
    return [year, year - 1, year - 2];
  });

  /** Recomputed whenever the filter or the activities change; there is no Generate step. */
  readonly report = computed(() =>
    this.reportService.generateSeasonReport(this.selectedSeason(), this.selectedYear()),
  );

  readonly categoryBars = computed<ExpenseBar[]>(() => {
    const report = this.report();
    return report.byCategory.map((c) => ({
      label: resolveReferenceName(
        this.translate,
        'expense',
        this.referenceData.expenseCategoryName(c.expenseCategoryId),
      ),
      amount: c.total,
      percent: report.totalExpense ? (c.total / report.totalExpense) * 100 : 0,
      barPercent: report.totalExpense ? (c.total / report.totalExpense) * 100 : 0,
    }));
  });

  readonly monthBars = computed<ExpenseBar[]>(() => {
    const months = this.report().byMonth;
    const max = Math.max(1, ...months.map((m) => m.total));
    return months.map((m) => ({
      label: m.month,
      amount: m.total,
      barPercent: (m.total / max) * 100,
    }));
  });

  readonly compareNames = computed(() => this.reportService.comparableCropNames());
  private readonly pickedCompareCrop = signal<string | null>(null);
  /** The chosen crop name, else the first one the farmer has grown. */
  readonly compareCrop = computed(() => this.pickedCompareCrop() ?? this.compareNames()[0] ?? '');
  readonly compareRows = computed(() => this.reportService.compareRows(this.compareCrop()));

  private reportPhaseMarked = false;

  constructor() {
    // The "report" workflow phase is done once the farmer has seen a report with data.
    effect(() => {
      if (this.report().hasData && !this.reportPhaseMarked) {
        this.reportPhaseMarked = true;
        this.workflowService.markPhaseComplete('report');
      }
    });
  }

  chooseCompareCrop(name: string): void {
    this.pickedCompareCrop.set(name);
  }

  exportCSV(): void {
    this.reportService.downloadCSV(this.report());
  }

  openCrop(cropId: number): void {
    void this.router.navigate(['/crops', cropId]);
  }

  onBackClicked(): void {
    void this.router.navigate(['/']);
  }
}
