import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Season } from '../../core/models/season';
import { ReportService, SeasonReport } from './report.service';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';
import { ReferenceDataService } from '../../core/api/reference-data.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [TranslatePipe, LocalNumberPipe, CommonModule, FormsModule],
  template: `
    <div class="container-fluid py-4 px-3 px-md-4">
      <div class="d-flex align-items-center mb-4 gap-2">
        <h1 class="mf-page-title m-0">
          <i class="bi bi-bar-chart-line-fill me-2 text-success"></i
          >{{ 'reports.title' | translate }}
        </h1>
      </div>

      <!-- Season & Year Selection -->
      <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label for="seasonSelect" class="form-label fw-semibold">{{
              'reports.season' | translate
            }}</label>
            <select id="seasonSelect" class="form-select" [(ngModel)]="selectedSeason">
              <option value="Kharif">{{ 'reports.kharif' | translate }}</option>
              <option value="Rabi">{{ 'reports.rabi' | translate }}</option>
              <option value="Zaid">{{ 'reports.zaid' | translate }}</option>
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label for="yearSelect" class="form-label fw-semibold">{{
              'reports.year' | translate
            }}</label>
            <select id="yearSelect" class="form-select" [(ngModel)]="selectedYear">
              <option *ngFor="let year of availableYears()" [ngValue]="year">{{ year }}</option>
            </select>
          </div>
          <div class="col-12">
            <button class="btn btn-success fw-semibold" (click)="generateReport()">
              <i class="bi bi-refresh me-1"></i>{{ 'reports.generate' | translate }}
            </button>
            <button
              *ngIf="report()"
              class="btn btn-outline-success fw-semibold ms-2"
              (click)="exportCSV()"
            >
              <i class="bi bi-download me-1"></i>{{ 'reports.exportCsv' | translate }}
            </button>
          </div>
        </div>
      </div>

      <ng-container *ngIf="report() as r">
        <!-- Report Summary -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4 bg-success-subtle">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <p class="text-muted small mb-1">{{ 'reports.totalSeasonExpenses' | translate }}</p>
              <h2 class="h3 text-success-dark fw-bold m-0">
                <i class="bi bi-currency-rupee"></i>{{ r.totalExpense | localNumber: '1.2-2' }}
              </h2>
            </div>
            <div class="text-end">
              <p class="text-muted small mb-1">{{ 'reports.crops' | translate }}</p>
              <h3 class="h4 text-success-dark fw-bold m-0">{{ r.byCrop.length }}</h3>
            </div>
            <div class="text-end">
              <p class="text-muted small mb-1">{{ 'reports.expenseLines' | translate }}</p>
              <h3 class="h4 text-success-dark fw-bold m-0">
                {{ getTotalCount(r) }}
              </h3>
            </div>
          </div>
        </div>

        <!-- Expenses by Category -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-tag-fill me-2 text-info"></i>{{ 'reports.byCategory' | translate }}
          </h3>
          <div *ngIf="r.byCategory.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>{{ 'reports.category' | translate }}</th>
                  <th class="text-end">{{ 'reports.amount' | translate }}</th>
                  <th class="text-end">{{ 'reports.count' | translate }}</th>
                  <th class="text-end">{{ 'reports.percentOfTotal' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cat of r.byCategory">
                  <td class="fw-medium">{{ categoryName(cat.expenseCategoryId) }}</td>
                  <td class="text-end">₹{{ cat.total | localNumber: '1.2-2' }}</td>
                  <td class="text-end">{{ cat.count }}</td>
                  <td class="text-end">
                    {{ (cat.total / r.totalExpense) * 100 | localNumber: '1.0-1' }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byCategory.length === 0" class="text-muted mb-0">
            {{ 'reports.noExpenses' | translate }}
          </p>
        </div>

        <!-- Expenses by Crop -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-grid-3x3-gap-fill me-2 text-warning"></i
            >{{ 'reports.byCrop' | translate }}
          </h3>
          <div *ngIf="r.byCrop.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>{{ 'reports.crop' | translate }}</th>
                  <th class="text-end">{{ 'reports.totalCost' | translate }}</th>
                  <th class="text-end">{{ 'reports.activities' | translate }}</th>
                  <th class="text-end">{{ 'reports.costPerActivity' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let crop of r.byCrop">
                  <td class="fw-medium">{{ crop.cropName }}</td>
                  <td class="text-end">₹{{ crop.total | localNumber: '1.2-2' }}</td>
                  <td class="text-end">{{ crop.activities }}</td>
                  <td class="text-end">
                    ₹{{ crop.total / crop.activities | localNumber: '1.0-0' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byCrop.length === 0" class="text-muted mb-0">
            {{ 'reports.noCrops' | translate }}
          </p>
        </div>

        <!-- Expenses by Month -->
        <div class="card border-0 shadow-sm p-3 p-md-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-calendar-month me-2 text-success"></i
            >{{ 'reports.byMonth' | translate }}
          </h3>
          <div *ngIf="r.byMonth.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>{{ 'reports.month' | translate }}</th>
                  <th class="text-end">{{ 'reports.amount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let month of r.byMonth">
                  <td>{{ month.month }}</td>
                  <td class="text-end fw-medium">₹{{ month.total | localNumber: '1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byMonth.length === 0" class="text-muted mb-0">
            {{ 'reports.noData' | translate }}
          </p>
        </div>
      </ng-container>

      <!-- Back to Home FAB - MOBILE ONLY -->
      <button
        type="button"
        class="btn rounded-circle shadow-lg d-flex d-md-none align-items-center justify-content-center fab-soft fab-soft-tertiary fab-stack-1"
        (click)="onBackClicked()"
        [title]="'common.backToHome' | translate"
      >
        <i class="bi bi-arrow-left"></i>
      </button>
    </div>
  `,
  styles: [
    `
      .mf-page-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--mf-leaf);
      }
    `,
  ],
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly router = inject(Router);
  private readonly workflowService = inject(WorkflowStateService);

  readonly selectedSeason = signal<Season>('Kharif');
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly report = signal<SeasonReport | null>(null);

  readonly availableYears = computed(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2];
  });

  generateReport(): void {
    const r = this.reportService.generateSeasonReport(this.selectedSeason(), this.selectedYear());
    this.report.set(r);
    this.workflowService.markPhaseComplete('report');
  }

  exportCSV(): void {
    const r = this.report();
    if (r) {
      this.reportService.downloadCSV(r);
    }
  }

  categoryName(expenseCategoryId: number): string {
    return this.referenceData.expenseCategoryName(expenseCategoryId);
  }

  getTotalCount(report: SeasonReport): number {
    return report.byCategory.reduce((sum, c) => sum + c.count, 0);
  }

  onBackClicked(): void {
    this.router.navigate(['/']);
  }
}
