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

  private cropsByName = new Map<string, string>();
  private cropsById = new Map<string, string>();
  private expensesByName = new Map<string, string>();
  private expensesById = new Map<string, string>();
  private activityTypesByName = new Map<string, string>();
  private activityTypesById = new Map<string, string>();

  private loadingPromise: Promise<void> | null = null;

  /** Force a re-fetch on next lookup (e.g. after seeding reference data). */
  invalidate(): void {
    this.loadingPromise = null;
    this.cropsByName.clear();
    this.cropsById.clear();
    this.expensesByName.clear();
    this.expensesById.clear();
    this.activityTypesByName.clear();
    this.activityTypesById.clear();
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadingPromise) {
      this.loadingPromise = this.loadAll();
    }
    try {
      await this.loadingPromise;
    } catch (error) {
      // Don't pin a rejected promise forever — a later call (once back
      // online) should retry the fetch instead of replaying this failure.
      this.loadingPromise = null;
      throw error;
    }
  }

  private async loadAll(): Promise<void> {
    const [crops, expenses, activityTypes] = await Promise.all([
      this.fetchAll('/reference/crops'),
      this.fetchAll('/reference/expense-categories'),
      this.fetchAll('/reference/activity-types'),
    ]);
    this.applyMaps(crops, expenses, activityTypes);
  }

  private applyMaps(
    crops: ReferenceItem[],
    expenses: ReferenceItem[],
    activityTypes: ReferenceItem[],
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
  }

  private async fetchAll(path: string): Promise<ReferenceItem[]> {
    const resp = await this.httpService.get<{ items: ReferenceItem[] }>(path);
    return resp.items;
  }

  async cropCatalogIdForName(name: string): Promise<string> {
    await this.ensureLoaded();
    const id = this.cropsByName.get(name);
    if (!id) {
      throw new Error(`Unknown crop "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async cropNameForId(id: string): Promise<string> {
    await this.ensureLoaded();
    return this.cropsById.get(id) ?? id;
  }

  async expenseCategoryIdForName(name: string): Promise<string> {
    await this.ensureLoaded();
    const id = this.expensesByName.get(name);
    if (!id) {
      throw new Error(`Unknown expense category "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async expenseCategoryNameForId(id: string): Promise<string> {
    await this.ensureLoaded();
    return this.expensesById.get(id) ?? id;
  }

  async activityTypeIdForName(name: string): Promise<string> {
    await this.ensureLoaded();
    const id = this.activityTypesByName.get(name);
    if (!id) {
      throw new Error(`Unknown activity type "${name}" — run /api/v1/admin/seed-reference-data`);
    }
    return id;
  }

  async activityTypeNameForId(id: string): Promise<string> {
    await this.ensureLoaded();
    return this.activityTypesById.get(id) ?? id;
  }

  async listCropNames(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.cropsByName.keys()).sort();
  }

  async createCrop(name: string): Promise<string> {
    const resp = await this.httpService.post<ReferenceItem>('/reference/crops', {
      name,
    });
    this.cropsByName.set(resp.name, resp.id);
    this.cropsById.set(resp.id, resp.name);
    return resp.id;
  }
}
