import { Component, ElementRef, signal, Input, computed, effect, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-history-trend',
  imports: [],
  templateUrl: './history-trend.component.html',
  styleUrl: './history-trend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryTrendComponent {
  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  // Internal active chart tab signal
  readonly activeTabSignal = signal<'weekly' | 'monthly' | 'yearly'>('weekly');

  @Input()
  set activeTab(val: 'weekly' | 'monthly' | 'yearly') {
    this.activeTabSignal.set(val);
  }

  get activeTab(): 'weekly' | 'monthly' | 'yearly' {
    return this.activeTabSignal();
  }

  // Chart datasets
  readonly weeklyData = [
    { label: 'Mon', temp: 28, rain: 15, humidity: 65 },
    { label: 'Tue', temp: 26, rain: 45, humidity: 80 },
    { label: 'Wed', temp: 31, rain: 5, humidity: 55 },
    { label: 'Thu', temp: 27, rain: 20, humidity: 70 },
    { label: 'Fri', temp: 25, rain: 60, humidity: 85 },
    { label: 'Sat', temp: 28, rain: 10, humidity: 68 },
    { label: 'Sun', temp: 30, rain: 2, humidity: 60 }
  ];

  readonly monthlyData = [
    { label: 'Week 1', temp: 27, rain: 120, humidity: 72 },
    { label: 'Week 2', temp: 29, rain: 80, humidity: 68 },
    { label: 'Week 3', temp: 31, rain: 40, humidity: 62 },
    { label: 'Week 4', temp: 28, rain: 150, humidity: 78 }
  ];

  readonly yearlyData = [
    { label: 'Jan', temp: 22, rain: 5, humidity: 45 },
    { label: 'Feb', temp: 24, rain: 8, humidity: 42 },
    { label: 'Mar', temp: 28, rain: 12, humidity: 40 },
    { label: 'Apr', temp: 32, rain: 15, humidity: 38 },
    { label: 'May', temp: 34, rain: 20, humidity: 42 },
    { label: 'Jun', temp: 31, rain: 180, humidity: 75 },
    { label: 'Jul', temp: 28, rain: 250, humidity: 82 },
    { label: 'Aug', temp: 27, rain: 220, humidity: 80 },
    { label: 'Sep', temp: 28, rain: 140, humidity: 78 },
    { label: 'Oct', temp: 29, rain: 45, humidity: 65 },
    { label: 'Nov', temp: 25, rain: 15, humidity: 55 },
    { label: 'Dec', temp: 23, rain: 8, humidity: 48 }
  ];

  // Active dataset computed signal
  readonly activeData = computed(() => {
    return this.activeTabSignal() === 'weekly'
      ? this.weeklyData
      : this.activeTabSignal() === 'monthly'
        ? this.monthlyData
        : this.yearlyData;
  });

  // Historical stats computed dynamically based on active timeframe
  readonly avgTemp = computed(() => {
    const data = this.activeData();
    const sum = data.reduce((acc, curr) => acc + curr.temp, 0);
    return Math.round(sum / data.length);
  });

  readonly totalRainfall = computed(() => {
    const data = this.activeData();
    const sum = data.reduce((acc, curr) => acc + curr.rain, 0);
    return Math.round(sum);
  });

  readonly avgHumidity = computed(() => {
    const data = this.activeData();
    const sum = data.reduce((acc, curr) => acc + curr.humidity, 0);
    return Math.round(sum / data.length);
  });

  readonly avgWind = computed(() => {
    return this.activeTabSignal() === 'weekly'
      ? 14
      : this.activeTabSignal() === 'monthly'
        ? 12
        : 16;
  });

  constructor() {
    effect((onCleanup) => {
      const canvasEl = this.chartCanvas();
      const data = this.activeData();

      if (!canvasEl || data.length === 0) return;

      const ctx = canvasEl.nativeElement.getContext('2d');
      if (!ctx) return;

      // Define area gradient for Temperature (Green)
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(46, 125, 50, 0.20)');
      gradient.addColorStop(1, 'rgba(46, 125, 50, 0.002)');

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [
            {
              label: 'Temp (°C)',
              data: data.map(d => d.temp),
              yAxisID: 'yTemp',
              borderColor: '#2e7d32',
              backgroundColor: gradient,
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#2e7d32',
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5
            },
            {
              label: 'Rainfall (mm)',
              data: data.map(d => d.rain),
              yAxisID: 'yRain',
              borderColor: '#42a5f5',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.3,
              borderWidth: 2.5,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#42a5f5',
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5
            },
            {
              label: 'Humidity (%)',
              data: data.map(d => d.humidity),
              yAxisID: 'yHum',
              borderColor: '#26a69a',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.3,
              borderWidth: 2.5,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#26a69a',
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
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
                title: (contexts) => {
                  if (contexts.length === 0) return '';
                  const label = contexts[0].label;
                  const currentYear = new Date().getFullYear();
                  const tab = this.activeTabSignal();
                  if (tab === 'weekly') {
                    const dayMap: { [key: string]: string } = {
                      'Mon': `Monday, May 25, ${currentYear}`,
                      'Tue': `Tuesday, May 26, ${currentYear}`,
                      'Wed': `Wednesday, May 27, ${currentYear}`,
                      'Thu': `Thursday, May 28, ${currentYear}`,
                      'Fri': `Friday, May 29, ${currentYear}`,
                      'Sat': `Saturday, May 30, ${currentYear}`,
                      'Sun': `Sunday, May 31, ${currentYear}`
                    };
                    return dayMap[label] || label;
                  } else if (tab === 'monthly') {
                    const weekMap: { [key: string]: string } = {
                      'Week 1': `Week 1 (May 1 - 7, ${currentYear})`,
                      'Week 2': `Week 2 (May 8 - 14, ${currentYear})`,
                      'Week 3': `Week 3 (May 15 - 21, ${currentYear})`,
                      'Week 4': `Week 4 (May 22 - 28, ${currentYear})`
                    };
                    return weekMap[label] || label;
                  } else {
                    const monthMap: { [key: string]: string } = {
                      'Jan': `January ${currentYear}`,
                      'Feb': `February ${currentYear}`,
                      'Mar': `March ${currentYear}`,
                      'Apr': `April ${currentYear}`,
                      'May': `May ${currentYear}`,
                      'Jun': `June ${currentYear}`,
                      'Jul': `July ${currentYear}`,
                      'Aug': `August ${currentYear}`,
                      'Sep': `September ${currentYear}`,
                      'Oct': `October ${currentYear}`,
                      'Nov': `November ${currentYear}`,
                      'Dec': `December ${currentYear}`
                    };
                    return monthMap[label] || label;
                  }
                },
                label: (context) => {
                  const value = context.parsed.y;
                  if (value === null || value === undefined) return '';
                  const label = context.dataset.label || '';
                  if (label.includes('Temp')) {
                    return ` Temp: ${value}°C`;
                  } else if (label.includes('Rainfall')) {
                    return ` Rainfall: ${value}mm`;
                  } else if (label.includes('Humidity')) {
                    return ` Humidity: ${value}%`;
                  }
                  return ` ${label}: ${value}`;
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
            yTemp: {
              type: 'linear',
              position: 'left',
              title: {
                display: true,
                text: 'Temp (°C)',
                color: '#2e7d32',
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
                color: '#2e7d32',
                font: {
                  family: 'Outfit, sans-serif',
                  size: 10
                },
                callback: (value) => `${value}°C`
              }
            },
            yHum: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'Humidity (%)',
                color: '#26a69a',
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
                color: '#26a69a',
                font: {
                  family: 'Outfit, sans-serif',
                  size: 10
                },
                callback: (value) => `${value}%`
              },
              min: 0,
              max: 100
            },
            yRain: {
              type: 'linear',
              position: 'left',
              display: false,
              min: 0
            }
          }
        }
      });

      onCleanup(() => {
        chart.destroy();
      });
    });
  }
}
