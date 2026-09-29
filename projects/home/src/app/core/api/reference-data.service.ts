import { Injectable, inject, signal } from '@angular/core';
import { HttpService } from '../http/http.service';
import { ReferenceItem } from './contracts';

/**
 * Translates between the backend's reference-table ids and the frontend's
 * fixed free-text enums.
 *
 * `Activity.type`, `CropEntity.cropType` and `ActivityExpense.category` are
 * plain string unions on the client (activity.constants.ts,
 * crop-timeline.component.ts's `cropNameOptions`) — the backend stores the
 * same concepts as FK ids into `activity_type` / `crop_catalog` /
 * `expense_category`, seeded once via `/api/v1/admin/seed-reference-data`
 * with names that must match those frontend enums exactly (see
 * admin.py's SEED_* lists). This is the one place that resolves between
 * the two, name<->id.
 */

type RefKind = 'crops' | 'expenses' | 'activityTypes' | 'seasons' | 'stages';

const REF_ENDPOINTS = {
  crops: { slot: 'cropsPromise', path: '/reference/crops' },
  expenses: { slot: 'expensesPromise', path: '/reference/expense-categories' },
  activityTypes: { slot: 'activityTypesPromise', path: '/reference/activity-types' },
  seasons: { slot: 'seasonsPromise', path: '/reference/seasons' },
  stages: { slot: 'stagesPromise', path: '/reference/crop-stages' },
} as const;

/** A missing id refetches its endpoint at most this often (never on a timer). */
const REFETCH_INTERVAL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly httpService = inject(HttpService);

  private cropsByName = new Map<string, number>();
  private cropsById = new Map<number, string>();
  private expensesByName = new Map<string, number>();
  private expensesById = new Map<number, string>();
  private activityTypesByName = new Map<string, number>();
  private activityTypesById = new Map<number, string>();
  private seasonsByName = new Map<string, number>();
  private seasonsById = new Map<number, string>();
  private stagesByName = new Map<string, number>();
  private stagesById = new Map<number, string>();

  // One cached promise per endpoint (not one for all five) so a single
  // endpoint failing doesn't force every other — already-successful —
  // endpoint to be re-fetched on the next lookup. Without this, a single
  // persistently-404ing endpoint (e.g. one not yet deployed) turned every
  // crop/expense/activity-type mapping call into a fresh 5-endpoint fetch.
  private cropsPromise: Promise<ReferenceItem[]> | null = null;
  private expensesPromise: Promise<ReferenceItem[]> | null = null;
  private activityTypesPromise: Promise<ReferenceItem[]> | null = null;
  private seasonsPromise: Promise<ReferenceItem[]> | null = null;
  private stagesPromise: Promise<ReferenceItem[]> | null = null;

  private readyPromise: Promise<void> | null = null;
  private loadedOnce = false;
  private readonly lastRefetch = new Map<RefKind, number>();
  private readonly versionSignal = signal(0);

  /** Bumps whenever a cached name changes, so signal/computed readers of the
   * sync accessors below re-evaluate once a name arrives. */
  readonly version = this.versionSignal.asReadonly();

  /**
   * Shared "reference data is loaded" promise. Reference-heavy pages await it
   * alongside their own data load; it reuses the per-endpoint cache, so it
   * never issues more requests than the first lookup would have.
   */
  ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.ensureLoaded().catch((error) => {
        this.readyPromise = null;
        throw error;
      });
    }
    return this.readyPromise;
  }

  /** Fire-and-forget warm-up, called once a session exists. Never blocks or throws. */
  preload(): void {
    this.ready().catch(() => undefined);
  }

  /** Synchronous crop name for `id`; `''` until loaded (or unknown). */
  cropName(id: number | null | undefined): string {
    return this.syncName('crops', this.cropsById, id);
  }

  /** Synchronous activity-type name for `id`; `''` until loaded (or unknown). */
  activityTypeName(id: number | null | undefined): string {
    return this.syncName('activityTypes', this.activityTypesById, id);
  }

  /** Synchronous expense-category name for `id`; `''` until loaded (or unknown). */
  expenseCategoryName(id: number | null | undefined): string {
    return this.syncName('expenses', this.expensesById, id);
  }

  private syncName(kind: RefKind, byId: Map<number, string>, id: number | null | undefined) {
    this.versionSignal(); // track cache changes in computed()/templates
    if (id === null || id === undefined) {
      return '';
    }
    const name = byId.get(id);
    if (name === undefined) {
      void this.refetchOnMiss(kind);
      return '';
    }
    return name;
  }

  /**
   * An id is missing from the cache (created on another device, or stale):
   * refetch just that endpoint, at most once per `REFETCH_INTERVAL_MS` per
   * endpoint, so an unknown id can never turn into repeated requests.
   * Resolves `true` when a refetch actually ran.
   */
  private async refetchOnMiss(kind: RefKind): Promise<boolean> {
    if (!this.loadedOnce) {
      return false; // first load is still in flight; it fetches everything anyway
    }
    const now = Date.now();
    const last = this.lastRefetch.get(kind);
    if (last !== undefined && now - last < REFETCH_INTERVAL_MS) {
      return false;
    }
    this.lastRefetch.set(kind, now);
    const { slot, path } = REF_ENDPOINTS[kind];
    this[slot] = null;
    try {
      const items = await this.load(slot, path);
      this.applyMaps(...this.itemsFor(kind, items));
      return true;
    } catch {
      return false;
    }
  }

  private itemsFor(
    kind: RefKind,
    items: ReferenceItem[],
  ): [ReferenceItem[], ReferenceItem[], ReferenceItem[], ReferenceItem[], ReferenceItem[]] {
    const none: ReferenceItem[] = [];
    return [
      kind === 'crops' ? items : none,
      kind === 'expenses' ? items : none,
      kind === 'activityTypes' ? items : none,
      kind === 'seasons' ? items : none,
      kind === 'stages' ? items : none,
    ];
  }

  /** Force a re-fetch on next lookup (e.g. after seeding reference data). */
  invalidate(): void {
    this.readyPromise = null;
    this.loadedOnce = false;
    this.lastRefetch.clear();
    this.cropsPromise = null;
    this.expensesPromise = null;
    this.activityTypesPromise = null;
    this.seasonsPromise = null;
    this.stagesPromise = null;
    this.cropsByName.clear();
    this.cropsById.clear();
    this.expensesByName.clear();
    this.expensesById.clear();
    this.activityTypesByName.clear();
    this.activityTypesById.clear();
    this.seasonsByName.clear();
    this.seasonsById.clear();
    this.stagesByName.clear();
    this.stagesById.clear();
  }

  /** Fetch (or reuse the in-flight/cached fetch of) one reference endpoint,
   * clearing its own cache slot — and only its own — on failure so a
   * retry doesn't refetch endpoints that already succeeded. */
  private load(
    slot:
      | 'cropsPromise'
      | 'expensesPromise'
      | 'activityTypesPromise'
      | 'seasonsPromise'
      | 'stagesPromise',
    path: string,
  ): Promise<ReferenceItem[]> {
    if (!this[slot]) {
      this[slot] = this.fetchAll(path).catch((error) => {
        this[slot] = null;
        throw error;
      });
    }
    return this[slot]!;
  }

  private async ensureLoaded(): Promise<void> {
    const [crops, expenses, activityTypes, seasons, stages] = await Promise.all([
      this.load('cropsPromise', '/reference/crops'),
      this.load('expensesPromise', '/reference/expense-categories'),
      this.load('activityTypesPromise', '/reference/activity-types'),
      this.load('seasonsPromise', '/reference/seasons'),
      this.load('stagesPromise', '/reference/crop-stages'),
    ]);
    this.applyMaps(crops, expenses, activityTypes, seasons, stages);
    this.loadedOnce = true;
  }

  private applyMaps(
    crops: ReferenceItem[],
    expenses: ReferenceItem[],
    activityTypes: ReferenceItem[],
    seasons: ReferenceItem[],
    stages: ReferenceItem[],
  ): void {
    let changed = false;
    const apply = (
      items: ReferenceItem[],
      byName: Map<string, number>,
      byId: Map<number, string>,
    ) => {
      for (const item of items) {
        if (byId.get(item.id) !== item.name) {
          changed = true;
        }
        byName.set(item.name, item.id);
        byId.set(item.id, item.name);
      }
    };
    apply(crops, this.cropsByName, this.cropsById);
    apply(expenses, this.expensesByName, this.expensesById);
    apply(activityTypes, this.activityTypesByName, this.activityTypesById);
    apply(seasons, this.seasonsByName, this.seasonsById);
    apply(stages, this.stagesByName, this.stagesById);
    if (changed) {
      this.versionSignal.update((v) => v + 1);
    }
  }

  private async fetchAll(path: string): Promise<ReferenceItem[]> {
    const resp = await this.httpService.get<{ items: ReferenceItem[] }>(path);
    return resp.items;
  }

  async cropCatalogIdForName(name: string): Promise<number> {
    await this.ensureLoaded();
    const id = this.cropsByName.get(name);
    if (id !== undefined) {
      return id;
    }
    // Not a seeded catalog name — the backend's POST /reference/crops is a
    // create-or-get, so any farmer-typed crop name becomes a real catalog
    // entry instead of failing.
    return this.createCrop(name);
  }

  async cropNameForId(id: number): Promise<string> {
    await this.ensureLoaded();
    if (!this.cropsById.has(id)) {
      await this.refetchOnMiss('crops');
    }
    return this.cropsById.get(id) ?? String(id);
  }

  async expenseCategoryIdForName(name: string): Promise<number> {
    await this.ensureLoaded();
    const id = this.expensesByName.get(name);
    if (id === undefined) {
      throw new Error(`Unknown expense category "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async expenseCategoryNameForId(id: number): Promise<string> {
    await this.ensureLoaded();
    if (!this.expensesById.has(id)) {
      await this.refetchOnMiss('expenses');
    }
    return this.expensesById.get(id) ?? String(id);
  }

  async activityTypeIdForName(name: string): Promise<number> {
    await this.ensureLoaded();
    const id = this.activityTypesByName.get(name);
    if (id === undefined) {
      throw new Error(`Unknown activity type "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async activityTypeNameForId(id: number): Promise<string> {
    await this.ensureLoaded();
    if (!this.activityTypesById.has(id)) {
      await this.refetchOnMiss('activityTypes');
    }
    return this.activityTypesById.get(id) ?? String(id);
  }

  async createActivityType(name: string): Promise<ReferenceItem> {
    const resp = await this.httpService.post<ReferenceItem>('/reference/activity-types', {
      name,
    });
    this.activityTypesByName.set(resp.name, resp.id);
    this.activityTypesById.set(resp.id, resp.name);
    return resp;
  }

  async listCropNames(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.cropsByName.keys()).sort();
  }

  async createCrop(name: string): Promise<number> {
    const resp = await this.httpService.post<ReferenceItem>('/reference/crops', {
      name,
    });
    this.cropsByName.set(resp.name, resp.id);
    this.cropsById.set(resp.id, resp.name);
    return resp.id;
  }

  async listSeasons(): Promise<ReferenceItem[]> {
    await this.ensureLoaded();
    return Array.from(this.seasonsByName.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listCropStages(): Promise<ReferenceItem[]> {
    await this.ensureLoaded();
    return Array.from(this.stagesByName.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listActivityTypes(): Promise<ReferenceItem[]> {
    await this.ensureLoaded();
    return Array.from(this.activityTypesByName.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listExpenseCategories(): Promise<ReferenceItem[]> {
    await this.ensureLoaded();
    return Array.from(this.expensesByName.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
