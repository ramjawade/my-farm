import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IStorageService } from '../storage/storage.interface';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import {
  CropEntity,
  CropStage,
  CropStatus,
} from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm, FarmAreaResult } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { ReferenceDataService } from './reference-data.service';
import { FarmerResponse, FarmerUpdateRequest } from './contracts';

const SQ_M_PER_HECTARE = 10_000;
const SQ_M_PER_ACRE = 4_046.8564224;
const EMPTY_AREA: FarmAreaResult = { squareMeters: 0, hectares: 0, acres: 0 };

function dateStringToTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

function timestampToDateString(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Remote API implementation of IStorageService.
 * Calls the MyFarm backend endpoints via Firebase-authenticated HTTP requests.
 * Online-only — no offline outbox.
 *
 * Every method transforms between the Angular model (SavedFarm, Activity,
 * CropEntity, ActivityExpense) and the backend schema (Land, Activity,
 * Crop, ActivityExpense) — see the mappers below. Three deliberate gaps,
 * all documented at their mapper:
 *  - `SavedFarm.points` / `.geoJson` (the drawn polygon) are now persisted
 *    to the backend on update.
 *  - `Activity.attachments` (base64 photos) aren't sent — that's Stage 7's
 *    R2 upload job.
 *  - `Activity.type` / `CropEntity.cropType` / `ActivityExpense.category`
 *    are free-text unions on the client but FK ids on the backend;
 *    ReferenceDataService resolves between the two by exact name match
 *    against the seeded reference tables.
 */
@Injectable({ providedIn: 'root' })
export class ApiStorageService extends IStorageService {
  private baseUrl = environment.apiBaseUrl;
  private token: string | null = null;
  private defaultFarmIdPromise: Promise<string> | null = null;
  private writeQueue: Promise<any> = Promise.resolve();

  constructor(
    private http: HttpClient,
    private referenceData: ReferenceDataService,
  ) {
    super();
  }

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.writeQueue.then(() => fn());
    this.writeQueue = promise.catch(() => {
      // Continue the queue even if this write fails
    });
    return promise;
  }

  /**
   * Set (or, with `null`, clear) the Firebase ID token for subsequent
   * requests. Called by the auth service after sign-in, and on logout /
   * session expiry — this service is a root singleton, so a token left
   * behind on logout would be sent as the next farmer's credentials.
   */
  setAuthToken(token: string | null): void {
    this.token = token;
    this.referenceData.setAuthToken(token);
  }

  private getHeaders(): HttpHeaders {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return new HttpHeaders(headers);
  }

  private async fetchList<T>(url: string): Promise<T[]> {
    const resp = await firstValueFrom(
      this.http.get<{ items: T[] }>(url, {
        headers: this.getHeaders(),
      }),
    );
    return resp.items;
  }

  /**
   * `Land.farm_id` is required, but `SavedFarm` (a plot) has no concept of
   * the top-level `Farm` the backend also tracks — the app has never had a
   * multi-farm model. Get-or-create a single default Farm per farmer,
   * cached in memory for the lifetime of this service.
   */
  async getOrCreateDefaultFarmId(): Promise<string> {
    if (!this.defaultFarmIdPromise) {
      this.defaultFarmIdPromise = this.resolveDefaultFarmId();
    }
    return this.defaultFarmIdPromise;
  }

  private async resolveDefaultFarmId(): Promise<string> {
    const list = await firstValueFrom(
      this.http.get<{ items: { id: string }[] }>(`${this.baseUrl}/farms`, {
        headers: this.getHeaders(),
      }),
    );
    if (list.items.length > 0) {
      return list.items[0].id;
    }
    const response = await firstValueFrom(
      this.http.post<{ id: string }>(
        `${this.baseUrl}/farms`,
        { name: 'My Farm' },
        { headers: this.getHeaders() },
      ),
    );
    return response.id;
  }

  // ============================================================================
  // Activities
  // ============================================================================

  async getActivities(userId: string): Promise<Activity[]> {
    try {
      const items = await this.fetchList<unknown>(`${this.baseUrl}/activities`);
      return await Promise.all(items.map((item) => this.mapFromBackendActivity(item)));
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    return this.enqueueWrite(async () => {
      const payload = await this.mapToBackendActivity(activity);
      try {
        const response = await firstValueFrom(
          this.http.post<unknown>(`${this.baseUrl}/activities`, payload, {
            headers: this.getHeaders(),
          }),
        );
        return await this.mapFromBackendActivity(response);
      } catch (error) {
        console.error('Failed to save activity:', error);
        throw error;
      }
    });
  }

  async updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = await this.mapToBackendActivity(updates);
      try {
        await firstValueFrom(
          this.http.patch(`${this.baseUrl}/activities/${id}`, payload, {
            headers: this.getHeaders(),
          }),
        );
      } catch (error) {
        console.error('Failed to update activity:', error);
        throw error;
      }
    });
  }

  async deleteActivity(userId: string, id: string): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await firstValueFrom(
          this.http.delete(`${this.baseUrl}/activities/${id}`, { headers: this.getHeaders() }),
        );
      } catch (error) {
        console.error('Failed to delete activity:', error);
        throw error;
      }
    });
  }

  async syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]> {
    try {
      const activities = await this.getActivities(userId);
      return activities.filter((a) => a.fieldId === fieldId);
    } catch (error) {
      console.error('Failed to sync activities for field:', error);
      return [];
    }
  }

  async syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchList<unknown>(
        `${this.baseUrl}/activities/${activityId}/expenses`,
      );
      return await Promise.all(items.map((item) => this.mapFromBackendExpense(item)));
    } catch (error) {
      console.error('Failed to sync expenses for activity:', error);
      return [];
    }
  }

  // ============================================================================
  // Expenses (nested under an activity)
  // ============================================================================

  async getExpenses(userId: string): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchList<unknown>(`${this.baseUrl}/expenses`);
      return await Promise.all(items.map((item) => this.mapFromBackendExpense(item)));
    } catch (error) {
      console.error('Failed to get expenses:', error);
      return [];
    }
  }

  async saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    return this.enqueueWrite(async () => {
      const payload = await this.mapToBackendExpense(expense);
      try {
        const response = await firstValueFrom(
          this.http.post<unknown>(
            `${this.baseUrl}/activities/${expense.activityId}/expenses`,
            payload,
            { headers: this.getHeaders() },
          ),
        );
        return await this.mapFromBackendExpense(response);
      } catch (error) {
        console.error('Failed to save expense:', error);
        throw error;
      }
    });
  }

  async updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = updates.activityId ?? (await this.findExpenseActivityId(id));
      if (!activityId) {
        throw new Error(`updateExpense: could not resolve the owning activity for expense ${id}`);
      }
      const payload = await this.mapToBackendExpense(updates);
      try {
        await firstValueFrom(
          this.http.patch(`${this.baseUrl}/activities/${activityId}/expenses/${id}`, payload, {
            headers: this.getHeaders(),
          }),
        );
      } catch (error) {
        console.error('Failed to update expense:', error);
        throw error;
      }
    });
  }

  async deleteExpense(userId: string, id: string): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = await this.findExpenseActivityId(id);
      if (!activityId) {
        console.warn(`deleteExpense: could not find the activity owning expense ${id}`);
        return;
      }
      try {
        await firstValueFrom(
          this.http.delete(`${this.baseUrl}/activities/${activityId}/expenses/${id}`, {
            headers: this.getHeaders(),
          }),
        );
      } catch (error) {
        console.error('Failed to delete expense:', error);
        throw error;
      }
    });
  }

  private async findExpenseActivityId(expenseId: string): Promise<string | null> {
    try {
      const expenses = await this.getExpenses('');
      const expense = expenses.find((e) => e.id === expenseId);
      return expense?.activityId ?? null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Crops
  // ============================================================================

  async getCrops(userId: string): Promise<CropEntity[]> {
    try {
      const items = await this.fetchList<unknown>(`${this.baseUrl}/crops`);
      return await Promise.all(items.map((item) => this.mapFromBackendCrop(item)));
    } catch (error) {
      console.error('Failed to get crops:', error);
      return [];
    }
  }

  async saveCrop(userId: string, crop: CropEntity): Promise<CropEntity> {
    return this.enqueueWrite(async () => {
      const payload = await this.mapToBackendCrop(crop);
      try {
        const response = await firstValueFrom(
          this.http.post<unknown>(`${this.baseUrl}/crops`, payload, { headers: this.getHeaders() }),
        );
        return await this.mapFromBackendCrop(response);
      } catch (error) {
        console.error('Failed to save crop:', error);
        throw error;
      }
    });
  }

  async updateCrop(userId: string, id: string, updates: Partial<CropEntity>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = await this.mapToBackendCrop(updates);
      try {
        await firstValueFrom(
          this.http.patch(`${this.baseUrl}/crops/${id}`, payload, { headers: this.getHeaders() }),
        );
      } catch (error) {
        console.error('Failed to update crop:', error);
        throw error;
      }
    });
  }

  async deleteCrop(userId: string, id: string): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await firstValueFrom(
          this.http.delete(`${this.baseUrl}/crops/${id}`, { headers: this.getHeaders() }),
        );
      } catch (error) {
        console.error('Failed to delete crop:', error);
        throw error;
      }
    });
  }

  // ============================================================================
  // Farms (SavedFarm here means a plot — backend calls it a Land)
  // ============================================================================

  async getFarms(userId: string): Promise<SavedFarm[]> {
    try {
      const items = await this.fetchList<unknown>(`${this.baseUrl}/lands`);
      return items.map((item) => this.mapFromBackendLand(item));
    } catch (error) {
      console.error('Failed to get farms:', error);
      return [];
    }
  }

  async saveFarm(userId: string, farm: SavedFarm): Promise<SavedFarm> {
    return this.enqueueWrite(async () => {
      const farmId = await this.getOrCreateDefaultFarmId();
      const payload = this.mapToBackendLand(farm, farmId);
      try {
        const response = await firstValueFrom(
          this.http.post<unknown>(`${this.baseUrl}/lands`, payload, { headers: this.getHeaders() }),
        );
        const mapped = this.mapFromBackendLand(response);
        return { ...mapped, points: farm.points, geoJson: farm.geoJson };
      } catch (error) {
        console.error('Failed to save farm:', error);
        throw error;
      }
    });
  }

  async updateFarm(userId: string, id: string, updates: Partial<SavedFarm>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = this.mapToBackendLand(updates);
      try {
        await firstValueFrom(
          this.http.patch(`${this.baseUrl}/lands/${id}`, payload, { headers: this.getHeaders() }),
        );
      } catch (error) {
        console.error('Failed to update farm:', error);
        throw error;
      }
    });
  }

  async deleteFarm(userId: string, id: string): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await firstValueFrom(
          this.http.delete(`${this.baseUrl}/lands/${id}`, { headers: this.getHeaders() }),
        );
      } catch (error) {
        console.error('Failed to delete farm:', error);
        throw error;
      }
    });
  }

  // ============================================================================
  // Farmers
  // ============================================================================

  async getFarmerById(id: string): Promise<FarmerRegistrationData | undefined> {
    // The backend has no GET /farmers/{id} — the only farmer this token can
    // read is its own, via /me. `AuthService.loadSession` passes the active
    // user's id here, so a match is the normal case.
    try {
      const response = await firstValueFrom(
        this.http.get<FarmerResponse>(`${this.baseUrl}/me`, {
          headers: this.getHeaders(),
        }),
      );
      return response.id === id ? this.mapFromBackendFarmer(response) : undefined;
    } catch (error) {
      console.error('Failed to get farmer by id:', error);
      return undefined;
    }
  }

  /**
   * Not supported on the API path. Sign-in is a single online
   * `POST /auth/session` (issue #50) — the login screen never resolves a
   * phone to a farmer record first, so there is nothing to return here.
   * `LocalStorageService` still implements this for the demo user.
   */
  async getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    return undefined;
  }

  async saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData> {
    return this.enqueueWrite(async () => {
      const body: FarmerUpdateRequest = {
        full_name: farmer.fullName || null,
        email: farmer.email ?? null,
        preferred_language: farmer.preferredLanguage || null,
      };
      try {
        const response = await firstValueFrom(
          this.http.patch<FarmerResponse>(`${this.baseUrl}/me`, body, {
            headers: this.getHeaders(),
          }),
        );
        return this.mapFromBackendFarmer(response);
      } catch (error) {
        console.error('Failed to save farmer profile:', error);
        return farmer;
      }
    });
  }

  // ============================================================================
  // Weather (Stage 7: server-cached weather endpoint)
  // ============================================================================

  // Weather history isn't persisted server-side — the live client-side
  // OpenWeather path (WeatherService) covers the MVP. Deliberate no-ops,
  // not errors: callers treat "no history" as normal.
  async getWeatherHistory(userId: string): Promise<WeatherData[]> {
    return [];
  }

  async saveWeatherSnapshot(userId: string, snapshot: WeatherData): Promise<WeatherData> {
    return snapshot;
  }

  // ============================================================================
  // Mappers: Angular models <-> backend schema
  // ============================================================================

  async mapFromBackendActivity(item: any): Promise<Activity> {
    return {
      id: item.id,
      parentActivityId: item.parent_activity_id ?? undefined,
      date: dateStringToTimestamp(item.date),
      season: item.season ?? undefined,
      cropId: item.crop_id ?? undefined,
      fieldId: item.land_id ?? undefined,
      type: (await this.referenceData.activityTypeNameForId(
        item.activity_type_id,
      )) as Activity['type'],
      customActivityName: item.custom_activity_name ?? undefined,
      status: item.status,
      notes: item.notes ?? undefined,
      metadata: item.activity_meta ?? undefined,
      createdAt: new Date(item.created_at).getTime(),
      updatedAt: new Date(item.updated_at).getTime(),
    };
  }

  async mapToBackendActivity(activity: Partial<Activity>): Promise<Record<string, unknown>> {
    return {
      activity_type_id:
        activity.type !== undefined
          ? await this.referenceData.activityTypeIdForName(activity.type)
          : undefined,
      crop_id: activity.cropId,
      land_id: activity.fieldId,
      // mapFromBackendActivity has always read this back; not sending it
      // meant a sub-activity's parent link was silently dropped on write.
      parent_activity_id: activity.parentActivityId,
      custom_activity_name: activity.customActivityName,
      date: timestampToDateString(activity.date),
      season: activity.season,
      status: activity.status,
      notes: activity.notes,
      activity_meta: activity.metadata,
    };
  }

  async mapFromBackendExpense(item: any): Promise<ActivityExpense> {
    return {
      id: item.id,
      activityId: item.activity_id,
      category: await this.referenceData.expenseCategoryNameForId(item.expense_category_id),
      itemId: item.item_id ?? undefined,
      resourceId: item.resource_id ?? undefined,
      quantity:
        item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : undefined,
      unit: item.unit ?? undefined,
      rate: item.rate !== null && item.rate !== undefined ? Number(item.rate) : undefined,
      amount: Number(item.amount ?? 0),
      remarks: item.remarks ?? undefined,
      createdAt: new Date(item.created_at).getTime(),
    };
  }

  async mapToBackendExpense(expense: Partial<ActivityExpense>): Promise<Record<string, unknown>> {
    return {
      expense_category_id:
        expense.category !== undefined
          ? await this.referenceData.expenseCategoryIdForName(expense.category)
          : undefined,
      item_id: expense.itemId,
      resource_id: expense.resourceId,
      quantity: expense.quantity,
      unit: expense.unit,
      rate: expense.rate,
      amount: expense.amount,
      remarks: expense.remarks,
    };
  }

  async mapFromBackendCrop(item: any): Promise<CropEntity> {
    return {
      id: item.id,
      fieldId: item.land_id,
      name: item.label ?? '',
      cropType: await this.referenceData.cropNameForId(item.crop_catalog_id),
      area: item.area !== null && item.area !== undefined ? Number(item.area) : 0,
      areaUnit: item.area_unit === 'hectares' ? 'hectares' : 'acres',
      season: item.season ?? undefined,
      sowingDate: dateStringToTimestamp(item.sowing_date),
      currentStage: (item.current_stage ?? 'Land Preparation') as CropStage,
      status: this.normalizeCropStatus(item.status),
      expectedHarvestDate: dateStringToTimestamp(item.expected_harvest_date),
    };
  }

  private normalizeCropStatus(status: unknown): CropStatus {
    return status === 'Completed' || status === 'Archived' ? status : 'Active';
  }

  async mapToBackendCrop(crop: Partial<CropEntity>): Promise<Record<string, unknown>> {
    return {
      land_id: crop.fieldId,
      crop_catalog_id:
        crop.cropType !== undefined
          ? await this.referenceData.cropCatalogIdForName(crop.cropType)
          : undefined,
      label: crop.name,
      area: crop.area,
      area_unit: crop.areaUnit,
      season: crop.season,
      sowing_date: timestampToDateString(crop.sowingDate),
      current_stage: crop.currentStage,
      status: crop.status,
      expected_harvest_date: timestampToDateString(crop.expectedHarvestDate),
    };
  }

  mapFromBackendLand(item: any): SavedFarm {
    const squareMeters =
      item.area_sq_m !== null && item.area_sq_m !== undefined ? Number(item.area_sq_m) : undefined;
    return {
      id: item.id,
      name: item.name,
      points: [],
      area:
        squareMeters !== undefined
          ? {
              squareMeters,
              hectares: squareMeters / SQ_M_PER_HECTARE,
              acres: squareMeters / SQ_M_PER_ACRE,
            }
          : EMPTY_AREA,
      geoJson: null,
      createdAt: new Date(item.created_at).getTime(),
      notes: item.notes ?? undefined,
    };
  }

  mapToBackendLand(farm: Partial<SavedFarm>, farmId?: string): Record<string, unknown> {
    return {
      name: farm.name,
      farm_id: farmId,
      area_sq_m: farm.area?.squareMeters,
      notes: farm.notes,
    };
  }

  /** The farm-setup half of `FarmerRegistrationData` — the backend Farmer
   * row has none of these (Farm is a separate entity), so every farmer
   * mapped from the API starts here. */
  private blankFarmer(): FarmerRegistrationData {
    return {
      id: '',
      fullName: '',
      phone: '',
      preferredLanguage: 'en',
      userRole: 'farmer',
      farmName: '',
      farmArea: 0,
      farmAreaUnit: 'acres',
      primaryCrops: [],
      waterSource: '',
      irrigationType: '',
      farmingMethod: '',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now(),
    };
  }

  private mapFromBackendFarmer(item: FarmerResponse): FarmerRegistrationData {
    return {
      ...this.blankFarmer(),
      id: item.id,
      fullName: item.full_name ?? '',
      phone: item.phone ?? '',
      email: item.email ?? undefined,
      preferredLanguage: item.preferred_language ?? 'en',
      userRole: item.user_role ?? 'farmer',
      createdAt: new Date(item.created_at).getTime(),
    };
  }
}
