import { Injectable } from '@angular/core';
import { HttpService } from '../http/http.service';
import { IStorageService } from '../storage/storage.interface';
import {
  Activity,
  ActivityExpense,
  NewActivity,
  NewActivityExpense,
} from '../../features/activity/activity.models';
import { CropEntity, NewCrop } from '../../features/crop-timeline/crop-timeline.models';
import { CropMapperService } from '../../features/crop-timeline/crop-mapper.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm, FarmAreaResult, NewSavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { ActivityMapperService } from './activity-mapper.service';
import { FarmerResponse, FarmerUpdateRequest } from './contracts';

const SQ_M_PER_HECTARE = 10_000;
const SQ_M_PER_ACRE = 4_046.8564224;
const EMPTY_AREA: FarmAreaResult = { squareMeters: 0, hectares: 0, acres: 0 };

/**
 * Remote API implementation of IStorageService.
 * Calls the MyFarm backend endpoints via Firebase-authenticated HTTP requests.
 * Online-only — no offline outbox.
 *
 * Every method transforms between the Angular model (SavedFarm, Activity,
 * CropEntity, ActivityExpense) and the backend schema (Land, Activity,
 * Crop, ActivityExpense). Activity/ActivityExpense mapping delegates to
 * `ActivityMapperService` and Crop mapping to `CropMapperService` — the
 * canonical, shared copies also used by the targeted-fetch services
 * (ActivityService, ActivityDetailService, crop-timeline) so the
 * `crop_catalog_id`/`activity_type_id`/`expense_category_id` <->
 * name resolution (via ReferenceDataService) lives in one place. Only Land
 * and Farmer mapping stay local here — neither is duplicated elsewhere.
 * Two deliberate gaps:
 *  - `Activity.attachments` (base64 photos) aren't sent — that's Stage 7's
 *    R2 upload job.
 *  - `SavedFarm.points`/`.geoJson` (the drawn polygon) round-trip through
 *    `saveFarm`'s in-memory merge only, not through a `GET /lands` re-fetch
 *    (see #193).
 */
@Injectable({ providedIn: 'root' })
export class ApiStorageService extends IStorageService {
  private defaultFarmIdPromise: Promise<number> | null = null;
  private writeQueue: Promise<any> = Promise.resolve();

  constructor(
    private httpService: HttpService,
    private activityMapper: ActivityMapperService,
    private cropMapper: CropMapperService,
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

  private async fetchList<T>(path: string): Promise<T[]> {
    const resp = await this.httpService.get<{ items: T[] }>(path);
    return resp.items;
  }

  /**
   * `Land.farm_id` is required, but `SavedFarm` (a plot) has no concept of
   * the top-level `Farm` the backend also tracks — the app has never had a
   * multi-farm model. Get-or-create a single default Farm per farmer,
   * cached in memory for the lifetime of this service.
   */
  async getOrCreateDefaultFarmId(): Promise<number> {
    if (!this.defaultFarmIdPromise) {
      this.defaultFarmIdPromise = this.resolveDefaultFarmId();
    }
    return this.defaultFarmIdPromise;
  }

  private async resolveDefaultFarmId(): Promise<number> {
    const list = await this.httpService.get<{ items: { id: number }[] }>('/farms');
    if (list.items.length > 0) {
      return list.items[0].id;
    }
    const response = await this.httpService.post<{ id: number }>('/farms', { name: 'My Farm' });
    return response.id;
  }

  // ============================================================================
  // Activities
  // ============================================================================

  async getActivities(userId: number): Promise<Activity[]> {
    try {
      const items = await this.fetchList<unknown>('/activities');
      return await Promise.all(items.map((item) => this.activityMapper.fromBackend(item)));
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  async saveActivity(userId: number, activity: NewActivity): Promise<Activity> {
    return this.enqueueWrite(async () => {
      const payload = await this.activityMapper.toBackend(activity);
      try {
        const response = await this.httpService.post<unknown>('/activities', payload);
        return await this.activityMapper.fromBackend(response);
      } catch (error) {
        console.error('Failed to save activity:', error);
        throw error;
      }
    });
  }

  async updateActivity(userId: number, id: number, updates: Partial<Activity>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = await this.activityMapper.toBackend(updates);
      try {
        await this.httpService.patch(`/activities/${id}`, payload);
      } catch (error) {
        console.error('Failed to update activity:', error);
        throw error;
      }
    });
  }

  async deleteActivity(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await this.httpService.delete(`/activities/${id}`);
      } catch (error) {
        console.error('Failed to delete activity:', error);
        throw error;
      }
    });
  }

  async syncActivitiesForField(userId: number, fieldId: number): Promise<Activity[]> {
    try {
      const activities = await this.getActivities(userId);
      return activities.filter((a) => a.fieldId === fieldId);
    } catch (error) {
      console.error('Failed to sync activities for field:', error);
      return [];
    }
  }

  async syncExpensesForActivity(userId: number, activityId: number): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchList<unknown>(`/activities/${activityId}/expenses`);
      return await Promise.all(items.map((item) => this.activityMapper.expenseFromBackend(item)));
    } catch (error) {
      console.error('Failed to sync expenses for activity:', error);
      return [];
    }
  }

  // ============================================================================
  // Expenses (nested under an activity)
  // ============================================================================

  async getExpenses(userId: number): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchList<unknown>('/activities/expenses');
      return await Promise.all(items.map((item) => this.activityMapper.expenseFromBackend(item)));
    } catch (error) {
      console.error('Failed to get expenses:', error);
      return [];
    }
  }

  async saveExpense(userId: number, expense: NewActivityExpense): Promise<ActivityExpense> {
    return this.enqueueWrite(async () => {
      const payload = await this.activityMapper.expenseToBackend(expense);
      try {
        const response = await this.httpService.post<unknown>(
          `/activities/${expense.activityId}/expenses`,
          payload,
        );
        return await this.activityMapper.expenseFromBackend(response);
      } catch (error) {
        console.error('Failed to save expense:', error);
        throw error;
      }
    });
  }

  async updateExpense(
    userId: number,
    id: number,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = updates.activityId ?? (await this.findExpenseActivityId(id));
      if (!activityId) {
        throw new Error(`updateExpense: could not resolve the owning activity for expense ${id}`);
      }
      const payload = await this.activityMapper.expenseToBackend(updates);
      try {
        await this.httpService.patch(`/activities/${activityId}/expenses/${id}`, payload);
      } catch (error) {
        console.error('Failed to update expense:', error);
        throw error;
      }
    });
  }

  async deleteExpense(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = await this.findExpenseActivityId(id);
      if (!activityId) {
        console.warn(`deleteExpense: could not find the activity owning expense ${id}`);
        return;
      }
      try {
        await this.httpService.delete(`/activities/${activityId}/expenses/${id}`);
      } catch (error) {
        console.error('Failed to delete expense:', error);
        throw error;
      }
    });
  }

  private async findExpenseActivityId(expenseId: number): Promise<number | null> {
    try {
      const expenses = await this.getExpenses(0);
      const expense = expenses.find((e) => e.id === expenseId);
      return expense?.activityId ?? null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Crops
  // ============================================================================

  async getCrops(userId: number): Promise<CropEntity[]> {
    try {
      const items = await this.fetchList<unknown>('/crops');
      return await Promise.all(items.map((item) => this.cropMapper.fromBackend(item)));
    } catch (error) {
      console.error('Failed to get crops:', error);
      return [];
    }
  }

  async saveCrop(userId: number, crop: NewCrop): Promise<CropEntity> {
    return this.enqueueWrite(async () => {
      const payload = await this.cropMapper.toBackend(crop);
      try {
        const response = await this.httpService.post<unknown>('/crops', payload);
        return await this.cropMapper.fromBackend(response);
      } catch (error) {
        console.error('Failed to save crop:', error);
        throw error;
      }
    });
  }

  async updateCrop(userId: number, id: number, updates: Partial<CropEntity>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = await this.cropMapper.toBackend(updates);
      try {
        await this.httpService.patch(`/crops/${id}`, payload);
      } catch (error) {
        console.error('Failed to update crop:', error);
        throw error;
      }
    });
  }

  async deleteCrop(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await this.httpService.delete(`/crops/${id}`);
      } catch (error) {
        console.error('Failed to delete crop:', error);
        throw error;
      }
    });
  }

  // ============================================================================
  // Farms (SavedFarm here means a plot — backend calls it a Land)
  // ============================================================================

  async getFarms(userId: number): Promise<SavedFarm[]> {
    try {
      const items = await this.fetchList<unknown>('/lands');
      return items.map((item) => this.mapFromBackendLand(item));
    } catch (error) {
      console.error('Failed to get farms:', error);
      return [];
    }
  }

  async saveFarm(userId: number, farm: NewSavedFarm): Promise<SavedFarm> {
    return this.enqueueWrite(async () => {
      const farmId = await this.getOrCreateDefaultFarmId();
      const payload = this.mapToBackendLand(farm, farmId);
      try {
        const response = await this.httpService.post<unknown>('/lands', payload);
        const mapped = this.mapFromBackendLand(response);
        return { ...mapped, points: farm.points, geoJson: farm.geoJson };
      } catch (error) {
        console.error('Failed to save farm:', error);
        throw error;
      }
    });
  }

  async updateFarm(userId: number, id: number, updates: Partial<SavedFarm>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = this.mapToBackendLand(updates);
      try {
        await this.httpService.patch(`/lands/${id}`, payload);
      } catch (error) {
        console.error('Failed to update farm:', error);
        throw error;
      }
    });
  }

  async deleteFarm(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await this.httpService.delete(`/lands/${id}`);
      } catch (error) {
        console.error('Failed to delete farm:', error);
        throw error;
      }
    });
  }

  // ============================================================================
  // Farmers
  // ============================================================================

  async getFarmerById(id: number): Promise<FarmerRegistrationData | undefined> {
    // The backend has no GET /farmers/{id} — the only farmer this token can
    // read is its own, via /me. `AuthService.loadSession` passes the active
    // user's id here, so a match is the normal case.
    try {
      const response = await this.httpService.get<FarmerResponse>('/me');
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
        const response = await this.httpService.patch<FarmerResponse>('/me', body);
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
  async getWeatherHistory(userId: number): Promise<WeatherData[]> {
    return [];
  }

  async saveWeatherSnapshot(userId: number, snapshot: WeatherData): Promise<WeatherData> {
    return snapshot;
  }

  // ============================================================================
  // Mappers: Angular models <-> backend schema
  //
  // Activity/ActivityExpense delegate to ActivityMapperService and Crop to
  // CropMapperService (both `providedIn: 'root'`, shared with the targeted-
  // fetch services) — only Land and Farmer mapping live here, since neither
  // is duplicated elsewhere.
  // ============================================================================

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

  mapToBackendLand(farm: Partial<SavedFarm>, farmId?: number): Record<string, unknown> {
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
      id: 0,
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
