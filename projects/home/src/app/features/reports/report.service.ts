import { Injectable, inject } from '@angular/core';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { Season } from '../../core/models/season';

export interface ExpenseByCategory {
  category: string;
  total: number;
  count: number;
}

export interface ExpenseByCrop {
  cropId: string;
  cropName: string;
  total: number;
  activities: number;
}

export interface ExpenseByMonth {
  month: string;
  total: number;
}

export interface SeasonReport {
  season: Season;
  year: number;
  totalExpense: number;
  byCategory: ExpenseByCategory[];
  byCrop: ExpenseByCrop[];
  byMonth: ExpenseByMonth[];
}

/** Aggregates expenses into season reports. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly activityService = inject(ActivityService);
  private readonly cropService = inject(CropTimelineService);

  generateSeasonReport(season: Season, year: number): SeasonReport {
    const seasonActivities = this.activityService
      .activities()
      .filter((a) => a.season === season && a.createdAt && new Date(a.createdAt).getFullYear() === year);

    const expenses = this.activityService
      .expenses()
      .filter((e) => {
        const a = this.activityService.getActivityById(e.activityId);
        return a && a.season === season && new Date(a.createdAt).getFullYear() === year;
      });

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = this.aggregateByCategory(expenses);
    const byCrop = this.aggregateByCrop(seasonActivities, expenses);
    const byMonth = this.aggregateByMonth(expenses);

    return {
      season,
      year,
      totalExpense,
      byCategory,
      byCrop,
      byMonth,
    };
  }

  private aggregateByCategory(expenses: any[]): ExpenseByCategory[] {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach((e) => {
      const existing = map.get(e.category) || { total: 0, count: 0 };
      map.set(e.category, {
        total: existing.total + e.amount,
        count: existing.count + 1,
      });
    });

    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  private aggregateByCrop(activities: any[], expenses: any[]): ExpenseByCrop[] {
    const map = new Map<string, { cropName: string; total: number; activities: number }>();
    activities.forEach((a) => {
      if (!a.cropId) return;
      const crop = this.cropService.getCropById(a.cropId);
      const cropName = crop?.name || 'Unknown Crop';
      const existing = map.get(a.cropId) || { cropName, total: 0, activities: 0 };
      map.set(a.cropId, {
        ...existing,
        cropName,
        activities: existing.activities + 1,
      });
    });

    expenses.forEach((e) => {
      const a = this.activityService.getActivityById(e.activityId);
      if (!a?.cropId) return;
      const crop = this.cropService.getCropById(a.cropId);
      const cropName = crop?.name || 'Unknown Crop';
      const existing = map.get(a.cropId);
      if (existing) {
        map.set(a.cropId, {
          ...existing,
          total: existing.total + e.amount,
        });
      }
    });

    return Array.from(map.entries())
      .map(([cropId, data]) => ({ cropId, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  private aggregateByMonth(expenses: any[]): ExpenseByMonth[] {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const date = new Date(e.createdAt);
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
    lines.push(`Total Expenses: ₹${report.totalExpense.toFixed(2)}`);
    lines.push('');

    lines.push('Expenses by Category');
    lines.push('Category,Amount,Count');
    report.byCategory.forEach((c) => {
      lines.push(`"${this.escapeCSV(c.category)}",${c.total.toFixed(2)},${c.count}`);
    });
    lines.push('');

    lines.push('Expenses by Crop');
    lines.push('Crop,Amount,Activities');
    report.byCrop.forEach((c) => {
      lines.push(`"${this.escapeCSV(c.cropName)}",${c.total.toFixed(2)},${c.activities}`);
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
