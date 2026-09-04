import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Season } from '../../core/models/season';
import { ReportService, SeasonReport } from './report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid py-4 px-3 px-md-4">
      <div class="d-flex align-items-center mb-4 gap-2">
        <h1 class="mf-page-title m-0">
          <i class="bi bi-bar-chart-line-fill me-2 text-success"></i>Reports
        </h1>
      </div>

      <!-- Season & Year Selection -->
      <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-6">
            <label for="seasonSelect" class="form-label fw-semibold">Season</label>
            <select id="seasonSelect" class="form-select" [(ngModel)]="selectedSeason">
              <option value="Kharif">Kharif (Jun–Oct)</option>
              <option value="Rabi">Rabi (Oct–Mar)</option>
              <option value="Zaid">Zaid (Mar–Jun)</option>
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label for="yearSelect" class="form-label fw-semibold">Year</label>
            <select id="yearSelect" class="form-select" [(ngModel)]="selectedYear">
              <option *ngFor="let year of availableYears()" [value]="year">{{ year }}</option>
            </select>
          </div>
          <div class="col-12">
            <button class="btn btn-success fw-semibold" (click)="generateReport()">
              <i class="bi bi-refresh me-1"></i>Generate Report
            </button>
            <button *ngIf="report()" class="btn btn-outline-success fw-semibold ms-2" (click)="exportCSV()">
              <i class="bi bi-download me-1"></i>Export CSV
            </button>
          </div>
        </div>
      </div>

      <ng-container *ngIf="report() as r">
        <!-- Report Summary -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4 bg-success-subtle">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <p class="text-muted small mb-1">Total Season Expenses</p>
              <h2 class="h3 text-success-dark fw-bold m-0">
                <i class="bi bi-currency-rupee"></i>{{ r.totalExpense | number: '1.2-2' }}
              </h2>
            </div>
            <div class="text-end">
              <p class="text-muted small mb-1">Crops</p>
              <h3 class="h4 text-success-dark fw-bold m-0">{{ r.byCrop.length }}</h3>
            </div>
            <div class="text-end">
              <p class="text-muted small mb-1">Expense Lines</p>
              <h3 class="h4 text-success-dark fw-bold m-0">
                {{ getTotalCount(r) }}
              </h3>
            </div>
          </div>
        </div>

        <!-- Expenses by Category -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-tag-fill me-2 text-info"></i>Expenses by Category
          </h3>
          <div *ngIf="r.byCategory.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Category</th>
                  <th class="text-end">Amount</th>
                  <th class="text-end">Count</th>
                  <th class="text-end">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cat of r.byCategory">
                  <td class="fw-medium">{{ cat.category }}</td>
                  <td class="text-end">₹{{ cat.total | number: '1.2-2' }}</td>
                  <td class="text-end">{{ cat.count }}</td>
                  <td class="text-end">{{ (cat.total / r.totalExpense * 100) | number: '1.0-1' }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byCategory.length === 0" class="text-muted mb-0">No expenses recorded for this season.</p>
        </div>

        <!-- Expenses by Crop -->
        <div class="card border-0 shadow-sm p-3 p-md-4 mb-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-grid-3x3-gap-fill me-2 text-warning"></i>Expenses by Crop
          </h3>
          <div *ngIf="r.byCrop.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Crop</th>
                  <th class="text-end">Total Cost</th>
                  <th class="text-end">Activities</th>
                  <th class="text-end">Cost/Activity</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let crop of r.byCrop">
                  <td class="fw-medium">{{ crop.cropName }}</td>
                  <td class="text-end">₹{{ crop.total | number: '1.2-2' }}</td>
                  <td class="text-end">{{ crop.activities }}</td>
                  <td class="text-end">₹{{ (crop.total / crop.activities) | number: '1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byCrop.length === 0" class="text-muted mb-0">No crops found for this season.</p>
        </div>

        <!-- Expenses by Month -->
        <div class="card border-0 shadow-sm p-3 p-md-4">
          <h3 class="h5 fw-bold mb-3">
            <i class="bi bi-calendar-month me-2 text-success"></i>Expenses by Month
          </h3>
          <div *ngIf="r.byMonth.length > 0" class="table-responsive">
            <table class="table table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Month</th>
                  <th class="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let month of r.byMonth">
                  <td>{{ month.month }}</td>
                  <td class="text-end fw-medium">₹{{ month.total | number: '1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="r.byMonth.length === 0" class="text-muted mb-0">No data available for this period.</p>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .mf-page-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: hsl(142, 52%, 38%);
    }
  `],
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);

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
  }

  exportCSV(): void {
    const r = this.report();
    if (r) {
      this.reportService.downloadCSV(r);
    }
  }

  getTotalCount(report: SeasonReport): number {
    return report.byCategory.reduce((sum, c) => sum + c.count, 0);
  }
}
