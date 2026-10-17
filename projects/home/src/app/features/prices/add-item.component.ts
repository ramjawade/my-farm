import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { CropMarketResponse, ReferenceItem } from '../../core/api/contracts';
import { I18n } from '../../core/i18n/i18n.service';
import { LocalNumberPipe } from '../../core/i18n/localized.pipes';
import { slugifyReferenceName } from '../../core/i18n/reference-name';
import { AddItemData } from './prices-data';
import { PricesService } from './prices.service';
import { MAX_LIST_ITEMS, WatchlistsService, refusalOf } from './watchlists.service';

/** How many markets the Market select offers for one crop. */
const MARKET_LIMIT = 50;

/** Adds a crop at a market to a watchlist: pick the crop, then one of the markets that price it. */
@Component({
  selector: 'app-add-item',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, LocalNumberPipe],
  templateUrl: './add-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddItemComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly prices = inject(PricesService);
  private readonly watchlists = inject(WatchlistsService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18n);

  /** Resolved before the page opens (see `addItemResolver`). */
  readonly data = input.required<AddItemData>();

  protected readonly maxItems = MAX_LIST_ITEMS;
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadingMarkets = signal(false);
  protected readonly marketsFailed = signal(false);
  protected readonly markets = signal<CropMarketResponse[]>([]);
  /** The backend refused after the page's own checks passed (a race). */
  protected readonly serverRefusal = signal<string | null>(null);

  protected readonly form = this.fb.group({
    cropId: [null as number | null, Validators.required],
    mandiId: [{ value: null as number | null, disabled: true }, Validators.required],
  });

  protected readonly ok = computed(() => {
    const data = this.data();
    return data.status === 'ok' ? data : null;
  });
  protected readonly listName = computed(() => this.ok()?.list.name ?? '');
  protected readonly full = computed(() => (this.ok()?.list.count ?? 0) >= MAX_LIST_ITEMS);

  /** Crops with a price, named in the app's language, A to Z. */
  protected readonly crops = computed(() =>
    (this.ok()?.crops ?? [])
      .map((crop) => ({ id: crop.id, label: this.cropLabel(crop) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  constructor() {
    this.form.controls.cropId.valueChanges.subscribe((cropId) => void this.chooseCrop(cropId));
  }

  private cropLabel(crop: ReferenceItem): string {
    if (crop.custom) return crop.name;
    const key = `crop.${slugifyReferenceName(crop.name)}`;
    const translated = this.i18n.t(key);
    return translated === key ? crop.name : translated;
  }

  private async chooseCrop(cropId: number | null): Promise<void> {
    const market = this.form.controls.mandiId;
    market.reset(null);
    this.markets.set([]);
    this.marketsFailed.set(false);
    if (cropId === null) {
      market.disable();
      return;
    }
    market.enable();
    this.loadingMarkets.set(true);
    try {
      const result = await this.prices.cropMarkets(cropId, { limit: MARKET_LIMIT });
      // Ignore an answer for a crop the farmer has already moved away from.
      if (this.form.controls.cropId.value === cropId) this.markets.set(result.markets);
    } catch {
      if (this.form.controls.cropId.value === cropId) this.marketsFailed.set(true);
    } finally {
      this.loadingMarkets.set(false);
    }
  }

  protected cropMessage(): string | null {
    return this.tried() && this.form.controls.cropId.invalid ? 'prices.pickCrop' : null;
  }

  protected marketMessage(): string | null {
    const ctrl = this.form.controls.mandiId;
    if (this.serverRefusal()) return this.serverRefusal();
    if (!this.tried()) return null;
    if (ctrl.value === null && this.form.controls.cropId.value !== null) return 'prices.pickMarket';
    if (this.isRepeat()) return 'prices.alreadyInList';
    return null;
  }

  private isRepeat(): boolean {
    const data = this.ok();
    const { cropId, mandiId } = this.form.getRawValue();
    return (
      !!data &&
      cropId !== null &&
      mandiId !== null &&
      data.existing.includes(`${cropId}:${mandiId}`)
    );
  }

  protected async submit(): Promise<void> {
    this.tried.set(true);
    this.serverRefusal.set(null);
    const { cropId, mandiId } = this.form.getRawValue();
    const data = this.ok();
    if (!data || this.full() || this.saving()) return;
    if (cropId === null || mandiId === null || this.isRepeat()) return;

    this.saving.set(true);
    try {
      await this.watchlists.addItem(data.list.id, cropId, mandiId);
      this.toast.success(this.translate.instant('prices.itemAdded', { list: data.list.name }));
      await this.router.navigate(['/prices'], { queryParams: { list: data.list.id } });
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal === 'duplicate_item') this.serverRefusal.set('prices.alreadyInList');
      else if (refusal === 'item_limit') this.serverRefusal.set('prices.itemLimit');
    } finally {
      this.saving.set(false);
    }
  }
}
