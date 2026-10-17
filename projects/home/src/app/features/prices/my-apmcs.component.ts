import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { MandiResponse } from '../../core/api/contracts';
import { MyApmcsData, loadMyApmcs } from './prices-data';
import { PricesService } from './prices.service';

export const MAX_MANDIS = 5;
const SEARCH_DELAY_MS = 300;

/** Pick the one to five mandis whose prices the farmer follows. */
@Component({
  selector: 'app-my-apmcs',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './my-apmcs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyApmcsComponent {
  private readonly prices = inject(PricesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /** Resolved before the page opens (see `myApmcsResolver`). */
  readonly data = input.required<MyApmcsData>();
  /** `?pick=1`: the farmer was sent here because there is no market to show prices for. */
  readonly pick = input<string>();

  protected readonly view = linkedSignal(() => this.data());
  protected readonly max = MAX_MANDIS;

  protected readonly chosen = linkedSignal<MandiResponse[]>(() => {
    const v = this.view();
    return v.status === 'ok' ? v.mine : [];
  });
  protected readonly suggested = linkedSignal(() => {
    const v = this.view();
    return v.status === 'ok' && v.suggested;
  });

  protected readonly districts = computed(() => {
    const v = this.view();
    return v.status === 'ok' ? v.districts : [];
  });
  private readonly commodities = computed(() => {
    const v = this.view();
    return v.status === 'ok' ? v.commodities : [];
  });

  protected readonly district = signal('');
  protected readonly query = signal('');
  protected readonly onlyMine = signal(false);
  protected readonly results = signal<MandiResponse[]>([]);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly retrying = signal(false);

  protected readonly full = computed(() => this.chosen().length >= MAX_MANDIS);
  protected readonly onlyOne = computed(() => this.chosen().length <= 1);
  private readonly chosenIds = computed(() => new Set(this.chosen().map((m) => m.id)));

  private timer: ReturnType<typeof setTimeout> | undefined;
  private searchToken = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    // The first list shows as soon as the page opens.
    queueMicrotask(() => void this.search());
  }

  protected isChosen(id: number): boolean {
    return this.chosenIds().has(id);
  }

  protected setDistrict(value: string): void {
    this.district.set(value);
    void this.search();
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(), SEARCH_DELAY_MS);
  }

  protected setOnlyMine(value: boolean): void {
    this.onlyMine.set(value);
    void this.search();
  }

  protected add(mandi: MandiResponse): void {
    if (this.full() || this.isChosen(mandi.id)) return;
    this.chosen.update((list) => [...list, mandi]);
    this.suggested.set(false);
  }

  protected remove(id: number): void {
    if (this.onlyOne()) return;
    this.chosen.update((list) => list.filter((m) => m.id !== id));
    this.suggested.set(false);
  }

  protected async save(): Promise<void> {
    if (this.chosen().length === 0 || this.saving()) return;
    this.saving.set(true);
    try {
      await this.prices.saveMandis(this.chosen().map((m) => m.id));
      this.toast.success(this.translate.instant('prices.savedToast'));
      await this.router.navigate(['/prices']);
    } catch {
      // The HTTP service already showed an error message; stay here with the choices.
    } finally {
      this.saving.set(false);
    }
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    try {
      this.view.set(await loadMyApmcs(this.prices));
      await this.search();
    } finally {
      this.retrying.set(false);
    }
  }

  /** Finds mandis for the current filters; "trades my crops" asks once per crop and merges. */
  private async search(): Promise<void> {
    const token = ++this.searchToken;
    this.searching.set(true);
    try {
      const base = { district: this.district() || undefined, q: this.query(), limit: 50 };
      let found: MandiResponse[];
      if (this.onlyMine() && this.commodities().length > 0) {
        const lists = await Promise.all(
          this.commodities().map((commodity) => this.prices.findMandis({ ...base, commodity })),
        );
        const byId = new Map(lists.flat().map((m) => [m.id, m]));
        found = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
      } else if (this.onlyMine()) {
        found = [];
      } else {
        found = await this.prices.findMandis(base);
      }
      if (token === this.searchToken) this.results.set(found);
    } catch {
      if (token === this.searchToken) this.results.set([]);
    } finally {
      if (token === this.searchToken) this.searching.set(false);
    }
  }
}
