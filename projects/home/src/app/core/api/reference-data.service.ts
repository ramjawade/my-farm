import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ReferenceItem {
  id: string;
  name: string;
}

interface ReferencePage {
  items: ReferenceItem[];
  cursor: string | null;
  has_more: boolean;
}

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
 *
 * The offline outbox (OutboxStorageService) needs to resolve these ids
 * while genuinely offline — an activity logged in the field can't wait for
 * a network round trip just to know its own id — so a successful load is
 * also persisted to localStorage and used as a fallback when the network
 * fetch fails. Reference data changes rarely enough (it's an admin-seeded,
 * effectively-static lookup table) that a stale cache is a reasonable
 * trade against blocking every offline write on connectivity.
 */
const LOCAL_CACHE_KEY = 'my_farm_reference_data_cache';

interface CachedReferenceData {
  crops: ReferenceItem[];
  expenses: ReferenceItem[];
  activityTypes: ReferenceItem[];
}

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly baseUrl = `${environment.apiBaseUrl}/reference`;
  private token: string | null = null;

  private cropsByName = new Map<string, string>();
  private cropsById = new Map<string, string>();
  private expensesByName = new Map<string, string>();
  private expensesById = new Map<string, string>();
  private activityTypesByName = new Map<string, string>();
  private activityTypesById = new Map<string, string>();

  private loadingPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  setAuthToken(token: string | null): void {
    this.token = token;
  }

  private getHeaders(): HttpHeaders {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return new HttpHeaders(headers);
  }

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
    try {
      const [crops, expenses, activityTypes] = await Promise.all([
        this.fetchAll(`${this.baseUrl}/crops`),
        this.fetchAll(`${this.baseUrl}/expense-categories`),
        this.fetchAll(`${this.baseUrl}/activity-types`),
      ]);
      this.applyMaps(crops, expenses, activityTypes);
      this.saveLocalCache({ crops, expenses, activityTypes });
    } catch (error) {
      if (!this.loadFromLocalCache()) {
        throw error;
      }
    }
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

  private saveLocalCache(data: CachedReferenceData): void {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — the in-memory maps are already
      // populated for this session, so this is a soft failure.
    }
  }

  private loadFromLocalCache(): boolean {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw) as CachedReferenceData;
      this.applyMaps(cached.crops, cached.expenses, cached.activityTypes);
      return true;
    } catch {
      return false;
    }
  }

  private async fetchAll(url: string): Promise<ReferenceItem[]> {
    const items: ReferenceItem[] = [];
    let cursor: string | null = null;
    do {
      const params: Record<string, string> = { limit: '200' };
      if (cursor) params['cursor'] = cursor;
      const resp = await firstValueFrom(
        this.http.get<ReferencePage>(url, { headers: this.getHeaders(), params }),
      );
      items.push(...resp.items);
      cursor = resp.has_more ? resp.cursor : null;
    } while (cursor);
    return items;
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
}
