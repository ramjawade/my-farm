import { Component, inject, computed, effect, input, output, ElementRef, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmActivityService } from '../farm-activity.service';
import { ActivityEntity, ActivityType } from '../../crop-timeline/crop-timeline.models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-activities-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activities-summary.component.html',
  styleUrl: './activities-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivitiesSummaryComponent {
  private readonly timelineService = inject(CropTimelineService);
  private readonly farmActivityService = inject(FarmActivityService);
  private readonly router = inject(Router);

  readonly cropId = input<string | undefined>();
  readonly isTimeline = input<boolean>(false);

  readonly editActivity = output<ActivityEntity>();
  readonly markActivityCompleted = output<string>();

  readonly allActivities = computed(() => {
    const cid = this.cropId();
    const all = this.timelineService.activities();
    if (cid) {
      return all.filter(a => a.cropId === cid);
    }
    return all;
  });

  readonly totalExpense = computed(() => {
    return this.allActivities().reduce((sum, a) => sum + (a.cost || 0), 0);
  });

  readonly activitiesCount = computed(() => {
    return this.allActivities().filter(a => a.status !== 'Planned').length;
  });

  readonly inProgressCount = computed(() => {
    return this.allActivities().filter(a => a.status === 'Scheduled').length;
  });

  readonly completedCount = computed(() => {
    return this.allActivities().filter(a => a.status === 'Completed').length;
  });

  readonly upcomingActivities = computed(() => {
    return this.allActivities()
      .filter(a => (a.status === 'Planned' || a.status === 'Scheduled') && !a.parentActivityId)
      .sort((a, b) => {
        const timeA = a.date !== undefined ? a.date : Infinity;
        const timeB = b.date !== undefined ? b.date : Infinity;
        return timeA - timeB;
      });
  });

  readonly recentActivities = computed(() => {
    return this.allActivities()
      .filter(a => a.status !== 'Planned')
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, 4);
  });

  readonly chartData = computed(() => {
    const acts = this.allActivities()
      .filter(a => a.status === 'Completed' && a.date !== undefined && a.date !== null)
      .sort((a, b) => (a.date || 0) - (b.date || 0));
      
    let cumulativeCost = 0;
    return acts.map((a, idx) => {
      cumulativeCost += (a.cost || 0);
      return {
        id: a.id,
        type: a.type,
        date: new Date(a.date || 0),
        timestamp: a.date || 0,
        activityIndex: idx + 1,
        cost: a.cost || 0,
        cumulativeCost
      };
    });
  });

  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  readonly activityTypes: { type: ActivityType; icon: string; color: string }[] = [
    { type: 'Sowing', icon: 'bi-seedling', color: '#38a169' },
    { type: 'Irrigation', icon: 'bi-droplet-half', color: '#3182ce' },
    { type: 'Fertilizer Application', icon: 'bi-box-seam', color: '#805ad5' },
    { type: 'Spray Application', icon: 'bi-wind', color: '#e53e3e' },
    { type: 'Weeding', icon: 'bi-scissors', color: '#dd6b20' },
    { type: 'Field Inspection', icon: 'bi-eye-fill', color: '#319795' },
    { type: 'Labour Activity', icon: 'bi-people-fill', color: '#4a5568' },
    { type: 'Harvest', icon: 'bi-flower3', color: '#d69e2e' },
    { type: 'Sale', icon: 'bi-cash-coin', color: '#38a169' },
    { type: 'Weather Incident', icon: 'bi-lightning-charge-fill', color: '#e53e3e' }
  ];

  constructor() {
    effect((onCleanup) => {
      const canvasEl = this.chartCanvas();
      const data = this.chartData();

      if (!canvasEl || data.length === 0) return;

      const ctx = canvasEl.nativeElement.getContext('2d');
      if (!ctx) return;

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })),
          datasets: [
            {
              label: 'Cumulative Expenses (Left Axis)',
              data: data.map(d => d.cumulativeCost),
              yAxisID: 'yExpenses',
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.06)',
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#059669',
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5
            },
            {
              label: 'Activities Logged (Right Axis)',
              data: data.map(d => d.activityIndex),
              yAxisID: 'yActivities',
              borderColor: '#319795',
              backgroundColor: 'transparent',
              borderDash: [4, 4],
              tension: 0.3,
              borderWidth: 2.5,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#319795',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointHoverBorderWidth: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 12,
                boxHeight: 3,
                usePointStyle: false,
                padding: 15,
                font: {
                  family: 'Outfit, sans-serif',
                  size: 11,
                  weight: 'bold'
                },
                color: '#4a5568'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              titleColor: '#5c4033',
              titleFont: {
                family: 'Outfit, sans-serif',
                weight: 'bold',
                size: 13
              },
              bodyColor: '#4a5568',
              bodyFont: {
                family: 'Outfit, sans-serif',
                size: 12
              },
              borderColor: 'rgba(42, 111, 71, 0.15)',
              borderWidth: 1,
              padding: 10,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  if (value === null || value === undefined) return '';
                  if (context.dataset.yAxisID === 'yExpenses') {
                    return ` Cumulative Expenses: ₹${value.toLocaleString()}`;
                  } else {
                    const item = data[context.dataIndex];
                    return ` Activity: #${value} (${item.type})`;
                  }
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: '#f8fafc'
              },
              ticks: {
                font: {
                  family: 'Outfit, sans-serif',
                  size: 10,
                  weight: 'bold'
                },
                color: '#64748b'
              }
            },
            yExpenses: {
              type: 'linear',
              position: 'left',
              title: {
                display: true,
                text: 'EXPENSES (₹)',
                color: '#10b981',
                font: {
                  family: 'Outfit, sans-serif',
                  weight: 'bold',
                  size: 11
                }
              },
              grid: {
                color: '#f1f5f9'
              },
              ticks: {
                color: '#245e3c',
                font: {
                  family: 'Outfit, sans-serif',
                  size: 10
                },
                callback: (value) => {
                  const val = Number(value);
                  return val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`;
                }
              }
            },
            yActivities: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'ACTIVITIES',
                color: '#319795',
                font: {
                  family: 'Outfit, sans-serif',
                  weight: 'bold',
                  size: 11
                }
              },
              grid: {
                drawOnChartArea: false
              },
              ticks: {
                color: '#475569',
                stepSize: 1,
                font: {
                  family: 'Outfit, sans-serif',
                  size: 10
                },
                callback: (value) => Math.round(Number(value))
              }
            }
          }
        }
      });

      onCleanup(() => {
        chart.destroy();
      });
    });
  }

  getActivityTotalCost(activityId: string): number {
    return this.farmActivityService.getTotalExpenseForActivity(activityId);
  }

  getActivityIcon(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.icon : 'bi-calendar-event';
  }

  getActivityEmoji(type: ActivityType): string {
    switch (type) {
      case 'Sowing': return '🌱';
      case 'Irrigation': return '💧';
      case 'Fertilizer Application': return '🌿';
      case 'Spray Application': return '🐛';
      case 'Weeding': return '✂️';
      case 'Field Inspection': return '📷';
      case 'Labour Activity': return '👥';
      case 'Harvest': return '🌾';
      case 'Sale': return '💰';
      case 'Weather Incident': return '⚡';
      default: return '📅';
    }
  }

  getActivityColor(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.color : '#4a5568';
  }

  onEditActivityClicked(act: ActivityEntity): void {
    if (this.isTimeline()) {
      this.editActivity.emit(act);
    } else {
      this.router.navigate(['/activities/create'], { queryParams: { activityId: act.id } });
    }
  }

  onMarkActivityCompletedClicked(id: string): void {
    if (this.isTimeline()) {
      this.markActivityCompleted.emit(id);
    } else {
      this.timelineService.updateActivity(id, {
        status: 'Completed',
        date: Date.now()
      });
    }
  }
}
