import { TranslatePipe } from '@ngx-translate/core';
import {
  Component,
  ElementRef,
  signal,
  Input,
  computed,
  effect,
  inject,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { cssColor, cssColorAlpha } from '../../../core/theme/css-token';
import { ThemeService } from '../../../core/theme/theme.service';
import { I18n } from '../../../core/i18n/i18n.service';
import { LocaleService } from '../../../core/i18n/locale.service';

Chart.register(...registerables);

@Component({
  selector: 'app-history-trend',
  imports: [TranslatePipe],
  templateUrl: './history-trend.component.html',
  styleUrl: './history-trend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryTrendComponent {
  private readonly theme = inject(ThemeService);
  private readonly i18n = inject(I18n);
  private readonly locale = inject(LocaleService);

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
    { label: 'Sun', temp: 30, rain: 2, humidity: 60 },
  ];

  readonly monthlyData = [
    { label: 'Week 1', temp: 27, rain: 120, humidity: 72 },
    { label: 'Week 2', temp: 29, rain: 80, humidity: 68 },
    { label: 'Week 3', temp: 31, rain: 40, humidity: 62 },
    { label: 'Week 4', temp: 28, rain: 150, humidity: 78 },
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
    { label: 'Dec', temp: 23, rain: 8, humidity: 48 },
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

  private temperatureToken(tempValue: number): string {
    if (tempValue < 15) return '--mf-temp-cold';
    if (tempValue < 25) return '--mf-temp-cool';
    if (tempValue < 35) return '--mf-temp-warm';
    return '--mf-temp-hot';
  }

  private getTemperatureColor(tempValue: number): string {
    return cssColor(this.temperatureToken(tempValue));
  }

  /** Same color family as `getTemperatureColor`, as an rgba string for gradient stops. */
  private temperatureColorRgba(tempValue: number, alpha: number): string {
    return cssColorAlpha(this.temperatureToken(tempValue), alpha);
  }

  /** Demo data is dated like the sample week it stands for; only the names follow the language. */
  private axisLabel(index: number): string {
    const year = new Date().getFullYear();
    switch (this.activeTabSignal()) {
      case 'weekly':
        return this.locale.date(new Date(year, 4, 25 + index), 'EEE');
      case 'monthly':
        return this.i18n.t('weather.weekN', { n: index + 1 });
      default:
        return this.locale.date(new Date(year, index, 1), 'MMM');
    }
  }

  private tooltipTitle(index: number): string {
    const year = new Date().getFullYear();
    switch (this.activeTabSignal()) {
      case 'weekly':
        return this.locale.date(new Date(year, 4, 25 + index), 'EEEE, d MMMM yyyy');
      case 'monthly': {
        const from = new Date(year, 4, 1 + index * 7);
        const to = new Date(year, 4, 7 + index * 7);
        const range = `${this.locale.date(from, 'd MMM')} - ${this.locale.date(to, 'd MMM yyyy')}`;
        return `${this.i18n.t('weather.weekN', { n: index + 1 })} (${range})`;
      }
      default:
        return this.locale.date(new Date(year, index, 1), 'MMMM yyyy');
    }
  }

  constructor() {
    effect((onCleanup) => {
      // Colours are resolved from the tokens when the chart is built, so
      // rebuild it when the theme changes.
      this.theme.resolved();
      const canvasEl = this.chartCanvas();
      const data = this.activeData();

      if (!canvasEl || data.length === 0) return;

      const ctx = canvasEl.nativeElement.getContext('2d');
      if (!ctx) return;

      // Area gradient uses the same thresholds/colors as the line (getTemperatureColor).
      const avgTemp = this.avgTemp();
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, this.temperatureColorRgba(avgTemp, 0.2));
      gradient.addColorStop(1, this.temperatureColorRgba(avgTemp, 0.002));

      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map((_, i) => this.axisLabel(i)),
          datasets: [
            {
              label: `${this.i18n.t('weather.temperature')} (°C)`,
              data: data.map((d) => d.temp),
              yAxisID: 'yTemp',
              borderColor: this.getTemperatureColor(this.avgTemp()),
              backgroundColor: gradient,
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointBackgroundColor: cssColor('--mf-surface'),
              pointBorderColor: this.getTemperatureColor(this.avgTemp()),
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5,
            },
            {
              label: `${this.i18n.t('weather.rainfall')} (mm)`,
              data: data.map((d) => d.rain),
              yAxisID: 'yRain',
              borderColor: cssColor('--mf-chart-2'),
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.3,
              borderWidth: 2.5,
              pointBackgroundColor: cssColor('--mf-surface'),
              pointBorderColor: cssColor('--mf-chart-2'),
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5,
            },
            {
              label: `${this.i18n.t('weather.humidity')} (%)`,
              data: data.map((d) => d.humidity),
              yAxisID: 'yHum',
              borderColor: cssColor('--mf-humidity'),
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.3,
              borderWidth: 2.5,
              pointBackgroundColor: cssColor('--mf-surface'),
              pointBorderColor: cssColor('--mf-humidity'),
              pointBorderWidth: 2,
              pointRadius: 4.5,
              pointHoverRadius: 6.5,
              pointHoverBorderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
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
                  family: 'Figtree, Mukta, sans-serif',
                  size: 11,
                  weight: 'bold',
                },
                color: cssColor('--mf-fg'),
              },
            },
            tooltip: {
              backgroundColor: cssColorAlpha('--mf-surface', 0.96),
              titleColor: cssColor('--mf-fg'),
              titleFont: {
                family: 'Figtree, Mukta, sans-serif',
                weight: 'bold',
                size: 13,
              },
              bodyColor: cssColor('--mf-muted'),
              bodyFont: {
                family: 'Figtree, Mukta, sans-serif',
                size: 12,
              },
              borderColor: cssColor('--mf-line'),
              borderWidth: 1,
              padding: 10,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                title: (contexts) =>
                  contexts.length === 0 ? '' : this.tooltipTitle(contexts[0].dataIndex),
                label: (context) => {
                  const value = context.parsed.y;
                  if (value === null || value === undefined) return '';
                  const units = ['°C', 'mm', '%'];
                  const names = ['weather.temperature', 'weather.rainfall', 'weather.humidity'];
                  const i = context.datasetIndex;
                  return ` ${this.i18n.t(names[i] ?? '')}: ${value}${units[i] ?? ''}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: {
                color: cssColor('--mf-line'),
              },
              ticks: {
                font: {
                  family: 'Figtree, Mukta, sans-serif',
                  size: 10,
                  weight: 'bold',
                },
                color: cssColor('--mf-muted'),
              },
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              title: {
                display: true,
                text: 'Temp (°C)',
                color: this.getTemperatureColor(this.avgTemp()),
                font: {
                  family: 'Figtree, Mukta, sans-serif',
                  weight: 'bold',
                  size: 11,
                },
              },
              grid: {
                color: cssColor('--mf-line'),
              },
              ticks: {
                color: this.getTemperatureColor(this.avgTemp()),
                font: {
                  family: 'Figtree, Mukta, sans-serif',
                  size: 10,
                },
                callback: (value) => `${value}°C`,
              },
            },
            yHum: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'Humidity (%)',
                color: cssColor('--mf-humidity'),
                font: {
                  family: 'Figtree, Mukta, sans-serif',
                  weight: 'bold',
                  size: 11,
                },
              },
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                color: cssColor('--mf-humidity'),
                font: {
                  family: 'Figtree, Mukta, sans-serif',
                  size: 10,
                },
                callback: (value) => `${value}%`,
              },
              min: 0,
              max: 100,
            },
            yRain: {
              type: 'linear',
              position: 'left',
              display: false,
              min: 0,
            },
          },
        },
      });

      onCleanup(() => {
        chart.destroy();
      });
    });
  }
}
