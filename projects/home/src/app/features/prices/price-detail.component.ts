import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PriceHistoryResponse } from '../../core/api/contracts';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { I18n } from '../../core/i18n/i18n.service';
import { LocalDatePipe, LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { cropIconClass } from '../crop-timeline/crop-timeline.utils';
import { ChartLine, PriceChartComponent } from './price-chart.component';
import { PriceDetailData, loadPriceDetail } from './prices-data';
import { HistoryDays, PricesService } from './prices.service';
import { averageBadge, changeDirection, isStale, periodChange, todayIso } from './prices.utils';

export const PERIODS: readonly HistoryDays[] = [7, 30, 365];
/** The main line, then up to three comparisons. */
const LINE_TOKENS = ['--mf-chart-1', '--mf-chart-2', '--mf-chart-3', '--mf-chart-4'];
export const MAX_COMPARE = 3;

const cacheKey = (mandiId: number, days: number): string => `${mandiId}|${days}`;

/** One crop type at one mandi: latest price, a chart for 7 days, 30 days or a year, and comparison. */
@Component({
  selector: 'app-price-detail',
  imports: [
    RouterLink,
    TranslatePipe,
    ReferenceNamePipe,
    LocalDatePipe,
    LocalNumberPipe,
    PriceChartComponent,
  ],
  templateUrl: './price-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceDetailComponent {
  private readonly prices = inject(PricesService);
  private readonly references = inject(ReferenceDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18n);

  /** Resolved before the page opens (see `priceDetailResolver`). */
  readonly data = input.required<PriceDetailData>();
  protected readonly view = linkedSignal(() => this.data());

  protected readonly periods = PERIODS;
  protected readonly maxCompare = MAX_COMPARE;
  protected readonly abs = Math.abs;
  protected readonly retrying = signal(false);
  protected readonly loadingLine = signal(false);

  protected readonly ok = computed(() => {
    const v = this.view();
    return v.status === 'ok' ? v : null;
  });

  protected readonly mandiId = linkedSignal(() => this.ok()?.mandiId ?? 0);
  protected readonly days = linkedSignal<HistoryDays>(() => this.ok()?.days ?? 30);
  protected readonly compare = signal<number[]>([]);

  /** History already fetched, by mandi and period; the resolver seeds the first one or two. */
  private readonly histories = linkedSignal(() => {
    const v = this.ok();
    const map = new Map<string, PriceHistoryResponse>();
    if (v) {
      map.set(cacheKey(v.mandiId, 30), v.history30);
      map.set(cacheKey(v.mandiId, v.days), v.history);
    }
    return map;
  });

  private readonly today = todayIso();

  protected readonly cropName = computed(() => {
    const v = this.ok();
    return v ? this.references.cropName(v.row.catalogId) : '';
  });
  protected readonly icon = computed(() => cropIconClass(this.cropName()));

  protected readonly selected = computed(() =>
    this.ok()?.priced.find((m) => m.mandi.id === this.mandiId()),
  );
  protected readonly others = computed(() =>
    (this.ok()?.priced ?? []).filter((m) => m.mandi.id !== this.mandiId()),
  );

  protected readonly history = computed(() =>
    this.histories().get(cacheKey(this.mandiId(), this.days())),
  );
  private readonly history30 = computed(() => this.histories().get(cacheKey(this.mandiId(), 30)));

  protected readonly badge = computed(() => {
    const price = this.selected()?.price;
    const average = this.history30()?.average;
    return typeof price === 'number' && typeof average === 'number'
      ? averageBadge(price, average)
      : null;
  });

  protected readonly direction = computed(() => changeDirection(this.selected()?.change_pct));
  protected readonly stale = computed(() => isStale(this.selected()?.price_date, this.today));

  protected readonly lines = computed<ChartLine[]>(() => {
    const main = this.selected();
    const days = this.days();
    if (!main) return [];
    const lines: ChartLine[] = [
      {
        name: main.mandi.name,
        token: LINE_TOKENS[0],
        dashed: false,
        points: this.history()?.points ?? [],
      },
    ];
    this.compare().forEach((id, index) => {
      const other = this.ok()?.priced.find((m) => m.mandi.id === id);
      if (!other) return;
      lines.push({
        name: other.mandi.name,
        token: LINE_TOKENS[index + 1],
        dashed: true,
        points: this.histories().get(cacheKey(id, days))?.points ?? [],
      });
    });
    return lines;
  });

  /** For the legend: each line's latest price and its change over the period. */
  protected readonly legend = computed(() =>
    this.lines().map((line) => {
      const last = line.points[line.points.length - 1];
      return {
        name: line.name,
        token: line.token,
        dashed: line.dashed,
        price: last?.price ?? null,
        change: periodChange(line.points),
      };
    }),
  );

  protected readonly pointCount = computed(() => this.history()?.points.length ?? 0);
  protected readonly shortHistory = computed(
    () => this.pointCount() > 0 && this.pointCount() < this.days(),
  );

  protected readonly chartLabel = computed(() => {
    const points = this.history()?.points ?? [];
    return this.i18n.t('prices.chartLabel', {
      crop: this.cropName(),
      mandi: this.selected()?.mandi.name ?? '',
      from: points[0]?.price ?? '',
      to: points[points.length - 1]?.price ?? '',
    });
  });

  protected periodKey(days: HistoryDays): string {
    return `prices.period.${days}`;
  }

  protected async selectMandi(id: number): Promise<void> {
    if (id === this.mandiId()) return;
    this.mandiId.set(id);
    this.compare.set([]);
    this.syncUrl();
    await this.ensure(id, 30);
    await this.ensure(id, this.days());
  }

  protected async setDays(days: HistoryDays): Promise<void> {
    if (days === this.days()) return;
    this.days.set(days);
    this.syncUrl();
    await Promise.all([this.mandiId(), ...this.compare()].map((id) => this.ensure(id, days)));
  }

  protected async toggleCompare(id: number): Promise<void> {
    const current = this.compare();
    if (current.includes(id)) {
      this.compare.set(current.filter((c) => c !== id));
      return;
    }
    if (current.length >= MAX_COMPARE) return;
    this.compare.set([...current, id]);
    await this.ensure(id, this.days());
  }

  protected compareIndex(id: number): number {
    return this.compare().indexOf(id);
  }

  protected compareToken(id: number): string {
    return LINE_TOKENS[this.compareIndex(id) + 1];
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    try {
      const params = this.route.snapshot;
      this.view.set(
        await loadPriceDetail(
          this.prices,
          Number(params.paramMap.get('crop')),
          Number(params.queryParamMap.get('mandi')),
          this.days(),
        ),
      );
    } finally {
      this.retrying.set(false);
    }
  }

  /** Fetches a mandi's history for a period unless it is already here. */
  private async ensure(mandiId: number, days: HistoryDays): Promise<void> {
    const v = this.ok();
    if (!v || this.histories().has(cacheKey(mandiId, days))) return;
    this.loadingLine.set(true);
    try {
      const fetched = await this.prices.history(mandiId, v.row.commodity!, days);
      this.histories.update((map) => new Map(map).set(cacheKey(mandiId, days), fetched));
    } catch {
      // The HTTP service already showed an error message; the line stays empty.
    } finally {
      this.loadingLine.set(false);
    }
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mandi: this.mandiId(), period: this.days() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
