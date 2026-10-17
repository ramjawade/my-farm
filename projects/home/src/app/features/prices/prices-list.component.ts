import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { LocalDatePipe, LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { cropIconClass } from '../crop-timeline/crop-timeline.utils';
import { PricesPageData, loadPricesPage } from './prices-data';
import { PricesService } from './prices.service';
import { changeDirection, gapFromBest, isStale, summarizeRow, todayIso } from './prices.utils';

/** The Prices page: the best price for each crop type among the mandis the farmer follows. */
@Component({
  selector: 'app-prices-list',
  imports: [RouterLink, TranslatePipe, ReferenceNamePipe, LocalDatePipe, LocalNumberPipe],
  templateUrl: './prices-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricesListComponent {
  private readonly prices = inject(PricesService);
  private readonly references = inject(ReferenceDataService);

  /** Resolved before the page opens (see `pricesResolver`). */
  readonly data = input.required<PricesPageData>();
  protected readonly view = linkedSignal(() => this.data());
  protected readonly reloading = signal(false);
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());

  private readonly today = todayIso();
  protected readonly abs = Math.abs;
  protected readonly gapFromBest = gapFromBest;

  protected readonly mandiCount = computed(() => {
    const view = this.view();
    return view.status === 'ok' ? view.mine.length : 0;
  });

  protected readonly items = computed(() => {
    const view = this.view();
    if (view.status !== 'ok') return [];
    return view.rows.map((row) => {
      const name = this.references.cropName(row.catalogId);
      const summary = summarizeRow(row);
      return {
        row,
        name,
        icon: cropIconClass(name),
        summary,
        direction: changeDirection(summary.best?.change_pct),
        stale: isStale(summary.best?.price_date, this.today),
      };
    });
  });

  protected toggle(catalogId: number): void {
    this.expanded.update((open) => {
      const next = new Set(open);
      if (!next.delete(catalogId)) next.add(catalogId);
      return next;
    });
  }

  protected async retry(): Promise<void> {
    this.reloading.set(true);
    try {
      await this.references.ready().catch(() => undefined);
      this.view.set(await loadPricesPage(this.prices));
    } finally {
      this.reloading.set(false);
    }
  }
}
