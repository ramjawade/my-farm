import { I18n } from '../../core/i18n/i18n.service';
import { Injectable, inject } from '@angular/core';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { Season } from '../../core/models/season';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { Activity, ActivityExpense } from '../activity/activity.models';
import {
  isCompletedSale,
  salesFromActivities,
  summarizeSales,
} from '../crop-timeline/crop-sales/sales-summary';

export interface ExpenseByCategory {
  expenseCategoryId: number;
  total: number;
  count: number;
}

/** One crop's sales against its expenses in the selected season. */
export interface CropProfit {
  cropId: number;
  cropName: string;
  /** Completed sales and their total. */
  soldCount: number;
  sales: number;
  expenses: number;
  /** Rounded to the rupee; null when the crop has no area. */
  profitPerAcre: number | null;
}

export interface ExpenseByMonth {
  month: string;
  total: number;
}

export interface SeasonReport {
  season: Season;
  year: number;
  totalExpense: number;
  /** Completed Sale activities in the selection. */
  totalSales: number;
  /** Total sales minus total expenses; includes crops that have no sales yet. */
  net: number;
  /** Crops with at least one Completed sale. */
  cropsSold: number;
  byCategory: ExpenseByCategory[];
  crops: CropProfit[];
  byMonth: ExpenseByMonth[];
  /** False when nothing was recorded in the selection. */
  hasData: boolean;
}

/** One sowing of a crop, for Compare seasons. */
export interface CompareRow {
  cropId: number;
  season?: Season;
  year?: number;
  /** Still growing. */
  inProgress: boolean;
  areaLabel: { area: number; unit: 'acres' | 'hectares' };
  sold: boolean;
  sales: number;
  expenses: number;
  profitPerAcre: number | null;
}

/** Aggregates expenses into season reports. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly i18n = inject(I18n);
  private readonly activityService = inject(ActivityService);
  private readonly cropService = inject(CropTimelineService);
  private readonly referenceData = inject(ReferenceDataService);

  /** When the work happened: the activity's own date, else when it was recorded. */
  private occurredAt(activity: { date?: number; createdAt: number }): number {
    return activity.date ?? activity.createdAt;
  }

  generateSeasonReport(season: Season, year: number): SeasonReport {
    const seasonActivities = this.activityService
      .activities()
      .filter((a) => a.season === season && new Date(this.occurredAt(a)).getFullYear() === year);

    const expenses = this.activityService.expenses().filter((e) => {
      const a = this.activityService.getActivityById(e.activityId);
      return a && a.season === season && new Date(this.occurredAt(a)).getFullYear() === year;
    });

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = this.aggregateByCategory(expenses);
    const crops = this.aggregateByCrop(seasonActivities, expenses);
    const byMonth = this.aggregateByMonth(expenses);
    const totalSales = seasonActivities
      .filter((a) => this.isCompletedSale(a))
      .reduce((sum, a) => sum + (a.sale?.amount ?? 0), 0);

    return {
      season,
      year,
      totalExpense,
      totalSales,
      net: totalSales - totalExpense,
      cropsSold: crops.filter((c) => c.soldCount > 0).length,
      byCategory,
      crops,
      byMonth,
      hasData: seasonActivities.length > 0 || expenses.length > 0,
    };
  }

  private isSaleType = (activityTypeId: number): boolean =>
    this.referenceData.isActivityType(activityTypeId, 'Sale');

  private isCompletedSale(activity: Activity): boolean {
    return activity.status === 'Completed' && this.isSaleType(activity.activityTypeId);
  }

  /** The crop names the farmer has grown, for the Compare seasons chips. */
  comparableCropNames(): string[] {
    return [...new Set(this.cropService.crops().map((c) => c.name))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  /**
   * One row per crop of that name, newest sowing first. Counts every Completed sale and
   * every expense of the crop, so it does not depend on the season filter.
   */
  compareRows(cropName: string): CompareRow[] {
    const activities = this.activityService.activities();
    return this.cropService
      .crops()
      .filter((c) => c.name === cropName)
      .map((crop) => {
        const sales = salesFromActivities(activities, crop.id, this.isSaleType);
        const expenses = this.cropService.costForCrop(crop.id);
        const summary = summarizeSales(sales, expenses, crop.area, crop.areaUnit);
        return {
          cropId: crop.id,
          season: crop.season,
          year: crop.sowingDate ? new Date(crop.sowingDate).getFullYear() : undefined,
          sowingDate: crop.sowingDate ?? 0,
          inProgress: crop.status === 'Active',
          areaLabel: { area: crop.area, unit: crop.areaUnit },
          sold: summary.hasCompleted,
          sales: summary.total,
          expenses,
          profitPerAcre: summary.profitPerAcre,
        };
      })
      .sort((a, b) => b.sowingDate - a.sowingDate || b.cropId - a.cropId)
      .map(({ sowingDate: _sowingDate, ...row }) => row);
  }

  private aggregateByCategory(expenses: any[]): ExpenseByCategory[] {
    const map = new Map<number, { total: number; count: number }>();
    expenses.forEach((e) => {
      const existing = map.get(e.expenseCategoryId) || { total: 0, count: 0 };
      map.set(e.expenseCategoryId, {
        total: existing.total + e.amount,
        count: existing.count + 1,
      });
    });

    return Array.from(map.entries())
      .map(([expenseCategoryId, data]) => ({ expenseCategoryId, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  /** Sales, expenses and profit per acre for each crop that has activity in the selection. */
  private aggregateByCrop(activities: Activity[], expenses: ActivityExpense[]): CropProfit[] {
    const cropIds = new Set<number>();
    activities.forEach((a) => a.cropId && cropIds.add(a.cropId));

    const expenseByCrop = new Map<number, number>();
    expenses.forEach((e) => {
      const cropId = this.activityService.getActivityById(e.activityId)?.cropId;
      if (cropId) expenseByCrop.set(cropId, (expenseByCrop.get(cropId) ?? 0) + e.amount);
    });

    return [...cropIds]
      .map((cropId) => {
        const crop = this.cropService.getCropById(cropId);
        const cropExpenses = expenseByCrop.get(cropId) ?? 0;
        const sales = salesFromActivities(activities, cropId, this.isSaleType);
        const summary = summarizeSales(
          sales,
          cropExpenses,
          crop?.area ?? 0,
          crop?.areaUnit ?? 'acres',
        );
        return {
          cropId,
          cropName: crop?.name || this.i18n.t('common.unknownCrop'),
          soldCount: sales.filter(isCompletedSale).length,
          sales: summary.total,
          expenses: cropExpenses,
          profitPerAcre: summary.profitPerAcre,
        };
      })
      .sort(
        (a, b) => (b.soldCount > 0 ? 1 : 0) - (a.soldCount > 0 ? 1 : 0) || b.expenses - a.expenses,
      );
  }

  private aggregateByMonth(expenses: any[]): ExpenseByMonth[] {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const activity = this.activityService.getActivityById(e.activityId);
      const date = new Date(activity ? this.occurredAt(activity) : e.createdAt);
      const monthKey = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      map.set(monthKey, (map.get(monthKey) || 0) + e.amount);
    });

    return Array.from(map.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
  }

  reportToCSV(report: SeasonReport): string {
    const lines: string[] = [];

    lines.push(`Season Report: ${report.season} ${report.year}`);
    lines.push(`Total Sales: ₹${report.totalSales.toFixed(2)}`);
    lines.push(`Total Expenses: ₹${report.totalExpense.toFixed(2)}`);
    lines.push(`Net So Far: ₹${report.net.toFixed(2)}`);
    lines.push(`Crops Sold: ${report.cropsSold} of ${report.crops.length}`);
    lines.push('');

    lines.push('Profit by Crop');
    lines.push('Crop,Sales,Expenses,Profit per Acre');
    report.crops.forEach((c) => {
      const perAcre = c.soldCount > 0 && c.profitPerAcre !== null ? String(c.profitPerAcre) : '';
      lines.push(
        `"${this.escapeCSV(c.cropName)}",${c.sales.toFixed(2)},${c.expenses.toFixed(2)},${perAcre}`,
      );
    });
    lines.push('');

    lines.push('Expenses by Category');
    lines.push('Category,Amount,Count');
    report.byCategory.forEach((c) => {
      const name = this.referenceData.expenseCategoryName(c.expenseCategoryId);
      lines.push(`"${this.escapeCSV(name)}",${c.total.toFixed(2)},${c.count}`);
    });
    lines.push('');

    lines.push('Expenses by Month');
    lines.push('Month,Amount');
    report.byMonth.forEach((m) => {
      lines.push(`"${m.month}",${m.total.toFixed(2)}`);
    });

    return lines.join('\n');
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }

  downloadCSV(report: SeasonReport): void {
    const csv = this.reportToCSV(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.season}-${report.year}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
