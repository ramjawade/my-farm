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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { WatchlistItemResponse, WatchlistResponse } from '../../core/api/contracts';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { LocalDatePipe, LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { cropIconClass } from '../crop-timeline/crop-timeline.utils';
import { PriceFigureComponent } from './price-figure.component';
import { PricesPageData, loadPricesPage } from './prices-data';
import { PricesService } from './prices.service';
import { gapFromBest, isStale, summarizeRow, todayIso } from './prices.utils';
import { WatchlistsService } from './watchlists.service';

/**
 * The Prices page. "My farm" shows the best price for each crop type among the mandis the
 * farmer follows; each watchlist shows its crop-at-market items. The chosen list is in the
 * `list` query parameter, so a list can be opened from a link.
 */
@Component({
  selector: 'app-prices-list',
  imports: [
    RouterLink,
    TranslatePipe,
    ReferenceNamePipe,
    LocalDatePipe,
    LocalNumberPipe,
    PriceFigureComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './prices-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricesListComponent {
  private readonly prices = inject(PricesService);
  private readonly watchlists = inject(WatchlistsService);
  private readonly references = inject(ReferenceDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /** Resolved before the page opens (see `pricesResolver`). */
  readonly data = input.required<PricesPageData>();
  /** `?list=<id>`: the chosen watchlist; absent for "My farm". */
  readonly list = input<string>();

  protected readonly view = linkedSignal(() => this.data());
  protected readonly reloading = signal(false);
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  protected readonly confirmDelete = signal(false);

  private readonly today = todayIso();
  protected readonly abs = Math.abs;
  protected readonly gapFromBest = gapFromBest;

  protected readonly lists = computed<WatchlistResponse[]>(() => {
    const view = this.view();
    return view.status === 'ok' ? view.lists : [];
  });

  /** The chosen watchlist, or null for "My farm" (also when the link names a deleted list). */
  protected readonly active = computed(() => {
    const id = Number(this.list());
    return this.lists().find((l) => l.id === id) ?? null;
  });

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
        stale: isStale(summary.best?.price_date, this.today),
      };
    });
  });

  /** The chosen list's items, ready to draw. */
  protected readonly watched = computed(() =>
    (this.active()?.items ?? []).map((item) => {
      const name = this.references.cropName(item.crop_catalog_id);
      return {
        item,
        name,
        icon: cropIconClass(name),
        priced: typeof item.price === 'number',
        stale: isStale(item.price_date, this.today),
      };
    }),
  );

  protected toggle(catalogId: number): void {
    this.expanded.update((open) => {
      const next = new Set(open);
      if (!next.delete(catalogId)) next.add(catalogId);
      return next;
    });
  }

  /** Shows a tab; "My farm" (null) clears the `list` parameter. */
  protected selectTab(listId: number | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { list: listId },
      queryParamsHandling: 'merge',
    });
  }

  protected askDelete(): void {
    this.confirmDelete.set(true);
  }

  protected async deleteList(): Promise<void> {
    const list = this.active();
    this.confirmDelete.set(false);
    if (!list) return;
    try {
      await this.watchlists.remove(list.id);
    } catch {
      return; // The HTTP service already showed an error message; the list stays.
    }
    this.updateLists((lists) => lists.filter((l) => l.id !== list.id));
    this.toast.success(this.translate.instant('prices.listDeleted'));
    this.selectTab(null);
  }

  protected async removeItem(list: WatchlistResponse, item: WatchlistItemResponse): Promise<void> {
    try {
      await this.watchlists.removeItem(list.id, item.id);
    } catch {
      return; // The HTTP service already showed an error message; the item stays.
    }
    this.updateLists((lists) =>
      lists.map((l) =>
        l.id === list.id ? { ...l, items: l.items.filter((i) => i.id !== item.id) } : l,
      ),
    );
  }

  protected async retry(): Promise<void> {
    this.reloading.set(true);
    try {
      await this.references.ready().catch(() => undefined);
      this.view.set(await loadPricesPage(this.prices, this.watchlists));
    } finally {
      this.reloading.set(false);
    }
  }

  private updateLists(change: (lists: WatchlistResponse[]) => WatchlistResponse[]): void {
    this.view.update((view) =>
      view.status === 'ok' ? { ...view, lists: change(view.lists) } : view,
    );
  }
}
