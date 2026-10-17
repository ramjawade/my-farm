import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Chart, registerables } from 'chart.js';
import { LocaleService } from '../../core/i18n/locale.service';
import { cssColor } from '../../core/theme/css-token';
import { ThemeService } from '../../core/theme/theme.service';
import { LinePoint } from './prices.utils';

Chart.register(...registerables);

/** One line on the chart: the main mandi, or one being compared. */
export interface ChartLine {
  name: string;
  /** A design token such as `--mf-leaf`, resolved when the chart is drawn. */
  token: string;
  dashed: boolean;
  points: LinePoint[];
}

/**
 * Daily prices for one to four mandis. Only days that have a reading are drawn, so a short
 * history is a few points, never an invented line. Redrawn when the lines or the theme change.
 */
@Component({
  selector: 'app-price-chart',
  imports: [TranslatePipe],
  templateUrl: './price-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceChartComponent {
  private readonly theme = inject(ThemeService);
  private readonly locale = inject(LocaleService);

  readonly lines = input.required<ChartLine[]>();
  /** Spoken summary of the chart, for screen readers. */
  readonly label = input('');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  /** Every date that has a reading on any line, oldest first. */
  protected readonly dates = computed(() =>
    [...new Set(this.lines().flatMap((l) => l.points.map((p) => p.date)))].sort(),
  );

  protected priceOn(line: ChartLine, date: string): number | null {
    return line.points.find((p) => p.date === date)?.price ?? null;
  }

  constructor() {
    effect((onCleanup) => {
      this.theme.resolved();
      const canvas = this.canvas();
      const lines = this.lines();
      const dates = this.dates();
      if (!canvas || dates.length === 0) return;

      const grid = cssColor('--mf-line');
      const text = cssColor('--mf-muted');
      const chart = new Chart(canvas.nativeElement, {
        type: 'line',
        data: {
          labels: dates.map((d) => this.locale.date(d, 'd MMM')),
          datasets: lines.map((line, index) => {
            const color = cssColor(line.token);
            return {
              label: line.name,
              data: dates.map((d) => this.priceOn(line, d)),
              borderColor: color,
              backgroundColor: color,
              borderDash: line.dashed ? [6, 4] : [],
              borderWidth: index === 0 ? 3 : 2,
              pointRadius: dates.length > 40 ? 0 : 4,
              pointHoverRadius: 6,
              tension: 0.25,
              spanGaps: true,
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => ` ${item.dataset.label}: ₹${Math.round(item.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: text, maxTicksLimit: 6 } },
            y: {
              grid: { color: grid },
              ticks: { color: text, callback: (value) => `₹${value}` },
            },
          },
        },
      });
      onCleanup(() => chart.destroy());
    });
  }
}
