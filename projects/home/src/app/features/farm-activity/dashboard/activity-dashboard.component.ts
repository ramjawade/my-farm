import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FarmActivityService } from '../farm-activity.service';

@Component({
  selector: 'app-activity-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  templateUrl: './activity-dashboard.component.html',
  styleUrl: './activity-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityDashboardComponent {
  private readonly activityService = inject(FarmActivityService);

  // Core signals from service
  readonly activities = this.activityService.activities;
  readonly expenses = this.activityService.expenses;

  // KPI Calculations
  readonly totalActivitiesCount = computed(() => this.activities().length);
  readonly totalExpensesAmount = computed(() => this.expenses().reduce((sum, exp) => sum + exp.amount, 0));
  
  readonly completedActivitiesCount = computed(() => 
    this.activities().filter(a => a.status === 'Completed').length
  );
  
  readonly inProgressActivitiesCount = computed(() => 
    this.activities().filter(a => a.status === 'In Progress').length
  );

  // SVG Chart: Expense by Category (Donut Chart)
  readonly categoryChartData = computed(() => {
    const expenses = this.expenses();
    const totals: { [cat: string]: number } = {};
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    
    const sorted = Object.entries(totals).map(([name, value]) => ({
      name,
      value,
      percentage: totalSum > 0 ? (value / totalSum) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    // Calculate SVG circle dash-array (circumference of R=50 is 314.159)
    const R = 50;
    const circumference = 2 * Math.PI * R; // ~314.159
    let accumulatedPercent = 0;

    const colors = [
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#ef4444', // Red
      '#6b7280'  // Gray
    ];

    return sorted.map((cat, index) => {
      const dashArray = `${circumference}`;
      const dashOffset = circumference - (cat.percentage / 100) * circumference;
      const rotation = (accumulatedPercent / 100) * 360;
      accumulatedPercent += cat.percentage;

      return {
        ...cat,
        dashArray,
        dashOffset,
        transformRotation: `rotate(${rotation - 90} 60 60)`,
        color: colors[index % colors.length]
      };
    });
  });

  // SVG Chart: Expense by Activity Type (Horizontal Bars)
  readonly activityChartData = computed(() => {
    const activities = this.activities();
    const expenses = this.expenses();
    const map: { [actName: string]: number } = {};

    expenses.forEach(e => {
      const parentAct = activities.find(a => a.id === e.activityId);
      const name = parentAct ? parentAct.activityId : 'Other / General';
      map[name] = (map[name] || 0) + e.amount;
    });

    const list = Object.entries(map).map(([name, amount]) => ({ name, amount }));
    const sorted = list.sort((a, b) => b.amount - a.amount);
    const maxVal = sorted.length > 0 ? Math.max(...sorted.map(s => s.amount)) : 1;

    const colors = [
      '#059669', // Emerald dark
      '#d97706', // Amber dark
      '#2563eb', // Blue dark
      '#7c3aed', // Purple dark
      '#db2777'  // Pink dark
    ];

    return sorted.map((item, index) => ({
      ...item,
      percentage: (item.amount / maxVal) * 100,
      color: colors[index % colors.length]
    }));
  });

  // SVG Chart: Monthly Trend (Area Chart)
  readonly monthlyTrendChartData = computed(() => {
    const expenses = this.expenses();
    const monthlyTotals: { [month: string]: number } = {};

    expenses.forEach(e => {
      const date = new Date(e.createdAt);
      // Create a nice display name: e.g. "Jun 2026"
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + e.amount;
    });

    const sortedMonths = Object.entries(monthlyTotals).map(([month, amount]) => ({
      month,
      amount,
      timestamp: new Date(month).getTime()
    })).sort((a, b) => a.timestamp - b.timestamp);

    if (sortedMonths.length === 0) {
      return { points: [], linePath: '', areaPath: '', gridLines: [] };
    }

    const width = 500;
    const height = 220;
    const paddingX = 40;
    const paddingY = 30;

    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    const maxVal = Math.max(...sortedMonths.map(m => m.amount), 1000) * 1.1; // 10% breathing room
    const minVal = 0;
    const valRange = maxVal - minVal;

    const points = sortedMonths.map((m, index) => {
      const x = paddingX + (index / Math.max(sortedMonths.length - 1, 1)) * chartWidth;
      const y = height - paddingY - ((m.amount - minVal) / valRange) * chartHeight;
      return { x, y, month: m.month, amount: m.amount };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    let areaPath = '';
    if (points.length > 0) {
      const first = points[0];
      const last = points[points.length - 1];
      areaPath = `${linePath} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`;
    }

    // Grid lines (horizontal intervals)
    const gridLines = [];
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const val = minVal + (i / gridCount) * valRange;
      const y = height - paddingY - (i / gridCount) * chartHeight;
      gridLines.push({
        y,
        label: val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val.toFixed(0)}`
      });
    }

    return {
      points,
      linePath,
      areaPath,
      gridLines
    };
  });

  // Get recent activities list to display on dashboard
  readonly recentActivities = computed(() => {
    return this.activities()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  });

  getActivityTotalCost(activityId: string): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }

  getActivityEmoji(name: string): string {
    const lower = (name || '').toLowerCase();
    if (lower.includes('bore') || lower.includes('well') || lower.includes('drill')) return '🚜';
    if (lower.includes('sow') || lower.includes('seed') || lower.includes('plant')) return '🌱';
    if (lower.includes('irrigate') || lower.includes('water') || lower.includes('sprinkl')) return '💧';
    if (lower.includes('spray') || lower.includes('pesticide') || lower.includes('insect') || lower.includes('fumigat')) return '💨';
    if (lower.includes('fertiliz') || lower.includes('manure') || lower.includes('urea') || lower.includes('nutrient')) return '🧴';
    if (lower.includes('harvest') || lower.includes('cut') || lower.includes('reap')) return '🌾';
    if (lower.includes('till') || lower.includes('plough') || lower.includes('tractor') || lower.includes('cultivat')) return '🚜';
    return '📋';
  }
}

