import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IStorageService } from '../storage/storage.interface';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { CropEntity } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { BackupFile } from '../storage/backup.models';

/**
 * Remote API implementation of IStorageService.
 * Calls the MyFarm backend endpoints via Firebase-authenticated HTTP requests.
 *
 * Every method transforms between the Angular model (SavedFarm, etc) and the
 * backend schema (Farm, Land, etc) — see mappers below.
 *
 * Stage 4: online-only, no outbox yet (Stage 5 adds that).
 */
@Injectable({ providedIn: 'root' })
export class ApiStorageService extends IStorageService {
  private baseUrl = '/api/v1';
  private token: string | null = null;

  constructor(private http: HttpClient) {
    super();
  }

  /**
   * Set the Firebase ID token for subsequent requests.
   * Called by the auth service after sign-in.
   */
  setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Drop the current token. Must be called on logout and on session expiry:
   * this service is a root singleton, so a token left behind here would be
   * sent as the next farmer's credentials.
   */
  clearAuthToken(): void {
    this.token = null;
  }

  private getHeaders(): HttpHeaders {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return new HttpHeaders(headers);
  }

  /**
   * Read every page of a cursor-paginated list endpoint.
   *
   * The backend defaults to `limit=20` and returns the continuation token as
   * `cursor` (the routers) or `next_cursor` (the `Page` schema) — accept
   * either so this keeps working whichever key the backend settles on.
   * Without this, every list silently stopped at the first 20 records.
   */
  private async fetchAllPages(path: string): Promise<any[]> {
    const all: any[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url = cursor
        ? `${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`
        : path;

      const response = await firstValueFrom(
        this.http.get<{ items?: any[]; cursor?: string | null; next_cursor?: string | null }>(
          url,
          { headers: this.getHeaders() },
        ),
      );

      all.push(...(response.items ?? []));

      const next = response.next_cursor ?? response.cursor ?? null;
      // Stop if the server repeats a cursor or never terminates, rather than
      // looping forever against a misbehaving endpoint.
      cursor = next && next !== cursor ? next : null;
    } while (cursor && ++pages < ApiStorageService.MAX_PAGES);

    return all;
  }

  /** Upper bound on pages walked per list call (20 records/page = 20k records). */
  private static readonly MAX_PAGES = 1000;

  // ============================================================================
  // Activities & Expenses
  // ============================================================================

  async getActivities(userId: string): Promise<Activity[]> {
    try {
      const items = await this.fetchAllPages(`${this.baseUrl}/activities`);
      return items.map((item) => this.mapFromBackendActivity(item));
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    const payload = this.mapToBackendActivity(activity);
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/activities`, payload, {
          headers: this.getHeaders(),
        }),
      );
      return this.mapFromBackendActivity(response);
    } catch (error) {
      console.error('Failed to save activity:', error);
      throw error;
    }
  }

  async updateActivity(
    userId: string,
    id: string,
    updates: Partial<Activity>,
  ): Promise<void> {
    const payload = this.mapToBackendActivity(updates);
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
  }

  async deleteActivity(userId: string, id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/activities/${id}`, {
          headers: this.getHeaders(),
        }),
      );
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  }

  async getExpenses(userId: string): Promise<ActivityExpense[]> {
    try {
      const activities = await this.getActivities(userId);
      const allExpenses: ActivityExpense[] = [];

      for (const activity of activities) {
        const items = await this.fetchAllPages(
          `${this.baseUrl}/activities/${activity.id}/expenses`,
        );
        allExpenses.push(...items.map((item) => this.mapFromBackendExpense(item)));
      }

      return allExpenses;
    } catch (error) {
      console.error('Failed to get expenses:', error);
      return [];
    }
  }

  async saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    const payload = this.mapToBackendExpense(expense);
    try {
      const response = await firstValueFrom(
        this.http.post<any>(
          `${this.baseUrl}/activities/${expense.activity_id}/expenses`,
          payload,
          {
            headers: this.getHeaders(),
          },
        ),
      );
      return this.mapFromBackendExpense(response);
    } catch (error) {
      console.error('Failed to save expense:', error);
      throw error;
    }
  }

  async updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    // This requires knowing the activity_id, which is problematic for a generic update.
    // In a real implementation, we'd need to either:
    // 1. Store activity_id in the expense object
    // 2. Query the expense first to get its activity_id
    // For now, throw an error.
    throw new Error('updateExpense requires activity_id context — not yet implemented');
  }

  async deleteExpense(userId: string, id: string): Promise<void> {
    // Same issue as updateExpense
    throw new Error('deleteExpense requires activity_id context — not yet implemented');
  }

  async syncActivitiesForField(
    userId: string,
    fieldId: string,
  ): Promise<Activity[]> {
    // This syncs activities for a specific field (land).
    // The backend doesn't have this filtering yet — would need a query parameter.
    try {
      const activities = await this.getActivities(userId);
      return activities.filter((a) => a.field_id === fieldId);
    } catch (error) {
      console.error('Failed to sync activities for field:', error);
      return [];
    }
  }

  async syncExpensesForActivity(
    userId: string,
    activityId: string,
  ): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchAllPages(
        `${this.baseUrl}/activities/${activityId}/expenses`,
      );
      return items.map((item) => this.mapFromBackendExpense(item));
    } catch (error) {
      console.error('Failed to sync expenses for activity:', error);
      return [];
    }
  }

  // ============================================================================
  // Crops
  // ============================================================================

  async getCrops(userId: string): Promise<CropEntity[]> {
    try {
      const items = await this.fetchAllPages(`${this.baseUrl}/crops`);
      return items.map((item) => this.mapFromBackendCrop(item));
    } catch (error) {
      console.error('Failed to get crops:', error);
      return [];
    }
  }

  async saveCrop(userId: string, crop: CropEntity): Promise<CropEntity> {
    const payload = this.mapToBackendCrop(crop);
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/crops`, payload, {
          headers: this.getHeaders(),
        }),
      );
      return this.mapFromBackendCrop(response);
    } catch (error) {
      console.error('Failed to save crop:', error);
      throw error;
    }
  }

  async updateCrop(userId: string, id: string, updates: Partial<CropEntity>): Promise<void> {
    const payload = this.mapToBackendCrop(updates);
    try {
      await firstValueFrom(
        this.http.patch(`${this.baseUrl}/crops/${id}`, payload, {
          headers: this.getHeaders(),
        }),
      );
    } catch (error) {
      console.error('Failed to update crop:', error);
      throw error;
    }
  }

  async deleteCrop(userId: string, id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/crops/${id}`, {
          headers: this.getHeaders(),
        }),
      );
    } catch (error) {
      console.error('Failed to delete crop:', error);
      throw error;
    }
  }

  // ============================================================================
  // Farms (Lands in the backend)
  // ============================================================================

  async getFarms(userId: string): Promise<SavedFarm[]> {
    try {
      const items = await this.fetchAllPages(`${this.baseUrl}/lands`);
      return items.map((item) => this.mapFromBackendLand(item));
    } catch (error) {
      console.error('Failed to get farms:', error);
      return [];
    }
  }

  async saveFarm(userId: string, farm: SavedFarm): Promise<SavedFarm> {
    const payload = this.mapToBackendLand(farm);
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.baseUrl}/lands`, payload, {
          headers: this.getHeaders(),
        }),
      );
      return this.mapFromBackendLand(response);
    } catch (error) {
      console.error('Failed to save farm:', error);
      throw error;
    }
  }

  async updateFarm(userId: string, id: string, updates: Partial<SavedFarm>): Promise<void> {
    const payload = this.mapToBackendLand(updates);
    try {
      await firstValueFrom(
        this.http.patch(`${this.baseUrl}/lands/${id}`, payload, {
          headers: this.getHeaders(),
        }),
      );
    } catch (error) {
      console.error('Failed to update farm:', error);
      throw error;
    }
  }

  async deleteFarm(userId: string, id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/lands/${id}`, {
          headers: this.getHeaders(),
        }),
      );
    } catch (error) {
      console.error('Failed to delete farm:', error);
      throw error;
    }
  }

  // ============================================================================
  // Farmers
  // ============================================================================

  async getFarmerById(id: string): Promise<FarmerRegistrationData | undefined> {
    // The backend doesn't expose a GET /farmers/:id endpoint.
    // For now, return the current farmer via /me.
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}/me`, {
          headers: this.getHeaders(),
        }),
      );
      if (response.id === id) {
        return this.mapFromBackendFarmer(response);
      }
      return undefined;
    } catch (error) {
      console.error('Failed to get farmer by id:', error);
      return undefined;
    }
  }

  async getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    // The backend doesn't expose a phone lookup endpoint.
    // In a real app, this would require an admin endpoint.
    console.warn('getFarmerByPhone not implemented — backend has no phone lookup');
    return undefined;
  }

  async saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData> {
    // Farmers are provisioned via the /me endpoint, not created.
    // This is a no-op that returns the input.
    console.warn('saveFarmer is a no-op — farmers are provisioned via /me');
    return farmer;
  }

  // ============================================================================
  // Weather
  // ============================================================================

  async getWeatherHistory(userId: string): Promise<WeatherData[]> {
    // The backend doesn't have a weather history endpoint yet.
    console.warn('getWeatherHistory not implemented — backend has no history endpoint');
    return [];
  }

  async saveWeatherSnapshot(userId: string, snapshot: WeatherData): Promise<WeatherData> {
    // Weather is server-cached by location grid (Stage 7).
    // Client save is a no-op.
    console.warn('saveWeatherSnapshot is a no-op — server manages weather');
    return snapshot;
  }

  // ============================================================================
  // Whole-account operations
  // ============================================================================

  async exportUserData(userId: string): Promise<BackupFile> {
    // Export is a future feature; not implemented.
    throw new Error('exportUserData not implemented');
  }

  async importUserData(userId: string, backup: BackupFile): Promise<void> {
    // Import is a future feature; not implemented.
    throw new Error('importUserData not implemented');
  }

  async clearUserData(userId: string): Promise<void> {
    // Clear is a destructive operation; requires confirmation.
    // Not implemented for now.
    throw new Error('clearUserData not implemented');
  }

  // ============================================================================
  // Mappers: Angular models ↔ Backend schema
  // ============================================================================

  private mapFromBackendActivity(item: any): Activity {
    return {
      id: item.id,
      farmer_id: item.farmer_id,
      field_id: item.land_id,
      activity_type_id: item.activity_type_id,
      custom_activity_name: item.custom_activity_name,
      date: item.date,
      season: item.season,
      status: item.status,
      notes: item.notes,
      activity_meta: item.activity_meta,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
    };
  }

  private mapToBackendActivity(activity: Partial<Activity>): any {
    return {
      activity_type_id: activity.activity_type_id,
      land_id: activity.field_id,
      custom_activity_name: activity.custom_activity_name,
      date: activity.date,
      season: activity.season,
      status: activity.status,
      notes: activity.notes,
      activity_meta: activity.activity_meta,
    };
  }

  private mapFromBackendExpense(item: any): ActivityExpense {
    return {
      id: item.id,
      activity_id: item.activity_id,
      expense_category_id: item.expense_category_id,
      item_id: item.item_id,
      resource_id: item.resource_id,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount,
      remarks: item.remarks,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
    };
  }

  private mapToBackendExpense(expense: Partial<ActivityExpense>): any {
    return {
      expense_category_id: expense.expense_category_id,
      item_id: expense.item_id,
      resource_id: expense.resource_id,
      quantity: expense.quantity,
      unit: expense.unit,
      rate: expense.rate,
      amount: expense.amount,
      remarks: expense.remarks,
    };
  }

  private mapFromBackendCrop(item: any): CropEntity {
    return {
      id: item.id,
      farmer_id: item.farmer_id,
      field_id: item.land_id,
      crop_catalog_id: item.crop_catalog_id,
      label: item.label,
      area: item.area,
      area_unit: item.area_unit,
      season: item.season,
      sowing_date: item.sowing_date,
      current_stage: item.current_stage,
      status: item.status,
      expected_harvest_date: item.expected_harvest_date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
    };
  }

  private mapToBackendCrop(crop: Partial<CropEntity>): any {
    return {
      land_id: crop.field_id,
      crop_catalog_id: crop.crop_catalog_id,
      label: crop.label,
      area: crop.area,
      area_unit: crop.area_unit,
      season: crop.season,
      sowing_date: crop.sowing_date,
      current_stage: crop.current_stage,
      status: crop.status,
      expected_harvest_date: crop.expected_harvest_date,
    };
  }

  private mapFromBackendLand(item: any): SavedFarm {
    return {
      id: item.id,
      farmer_id: item.farmer_id,
      farm_id: item.farm_id,
      name: item.name,
      area_sq_m: item.area_sq_m,
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
    };
  }

  private mapToBackendLand(farm: Partial<SavedFarm>): any {
    return {
      name: farm.name,
      farm_id: farm.farm_id,
      area_sq_m: farm.area_sq_m,
      notes: farm.notes,
    };
  }

  private mapFromBackendFarmer(item: any): FarmerRegistrationData {
    return {
      id: item.id,
      auth_uid: item.auth_uid,
      phone: item.phone,
      full_name: item.full_name,
      email: item.email,
      preferred_language: item.preferred_language,
      user_role: item.user_role,
    };
  }
}
