import { Injectable, inject, signal } from '@angular/core';
import { HttpService } from '../http/http.service';
import { ReferenceItem } from './contracts';
import { ActivityType } from '../../features/activity/activity.models';

/**
 * Cache of the backend's reference tables (crops, expense categories,
 * activity types, seasons, crop stages).
 *
 * Domain models carry the FK ids; this service turns them into display
 * names (`cropName`, `activityTypeName`, `expenseCategoryName` — sync, empty
 * until loaded, and `ReferenceNamePipe` for templates) and turns a name the
 * farmer picked into an id at the form/API boundary (`*IdForName`). Loaded
 * once after sign-in (`preload`); `ready()` resolves when it is warm.
 */
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
    return this.syncName(this.cropsById, id);
  }

  /** Synchronous activity-type name for `id`; `''` until loaded (or unknown). */
  activityTypeName(id: number | null | undefined): string {
    return this.syncName(this.activityTypesById, id);
  }

  /**
   * Whether activity type `id` is the seeded type called `name` (`'Custom'`,
   * `'Harvest'`, ...). Compares the resolved name, so it is `false` until the
   * data has loaded — await `ready()` before logic that depends on it.
   */
  isActivityType(id: number | null | undefined, name: ActivityType): boolean {
    return this.activityTypeName(id) === name;
  }

  /** Synchronous expense-category name for `id`; `''` until loaded (or unknown). */
  expenseCategoryName(id: number | null | undefined): string {
    return this.syncName(this.expensesById, id);
  }

  private syncName(byId: Map<number, string>, id: number | null | undefined): string {
    this.versionSignal(); // track cache changes in computed()/templates
    return id === null || id === undefined ? '' : (byId.get(id) ?? '');
  }

  /** Force a re-fetch on next lookup (e.g. after seeding reference data). */
  invalidate(): void {
    this.readyPromise = null;
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

  async expenseCategoryIdForName(name: string): Promise<number> {
    await this.ensureLoaded();
    const id = this.expensesByName.get(name);
    if (id === undefined) {
      throw new Error(`Unknown expense category "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async activityTypeIdForName(name: string): Promise<number> {
    await this.ensureLoaded();
    const id = this.activityTypesByName.get(name);
    if (id === undefined) {
      throw new Error(`Unknown activity type "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
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
