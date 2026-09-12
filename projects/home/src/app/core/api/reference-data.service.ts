import { Injectable, inject } from '@angular/core';
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

  /** Force a re-fetch on next lookup (e.g. after seeding reference data). */
  invalidate(): void {
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
    for (const c of crops) {
      this.cropsByName.set(c.name, c.id);
      this.cropsById.set(c.id, c.name);
    }
    for (const e of expenses) {
      this.expensesByName.set(e.name, e.id);
      this.expensesById.set(e.id, e.name);
    }
    for (const a of activityTypes) {
      this.activityTypesByName.set(a.name, a.id);
      this.activityTypesById.set(a.id, a.name);
    }
    for (const s of seasons) {
      this.seasonsByName.set(s.name, s.id);
      this.seasonsById.set(s.id, s.name);
    }
    for (const st of stages) {
      this.stagesByName.set(st.name, st.id);
      this.stagesById.set(st.id, st.name);
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
