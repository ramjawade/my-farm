import { Injectable, inject } from '@angular/core';
import { HttpService } from '../http/http.service';
import { FarmResponse, FarmUpdateRequest } from './contracts';

/** Name the backend gets when a farm is created before the farmer named it. */
export const DEFAULT_FARM_NAME = 'My Farm';

/**
 * The farmer's top-level `Farm` records. The app has one farm per farmer, so
 * the "default farm" is the lowest-id one (stable, unlike list order, which
 * follows last update). Shared by the profile and the Lands feature.
 */
@Injectable({ providedIn: 'root' })
export class FarmsApiService {
  private readonly http = inject(HttpService);

  /** The farmer's default farm, or null when they have none yet. */
  async getDefaultFarm(): Promise<FarmResponse | null> {
    const list = await this.http.get<{ items: FarmResponse[] }>('/farms');
    if (list.items.length === 0) return null;
    return list.items.reduce((first, farm) => (farm.id < first.id ? farm : first));
  }

  async getOrCreateDefaultFarmId(): Promise<number> {
    const farm = await this.getDefaultFarm();
    if (farm) return farm.id;
    const created = await this.http.post<FarmResponse>('/farms', { name: DEFAULT_FARM_NAME });
    return created.id;
  }

  /** Update the default farm, creating it first when the farmer has none. */
  async updateDefaultFarm(updates: FarmUpdateRequest): Promise<FarmResponse> {
    const id = await this.getOrCreateDefaultFarmId();
    return this.http.patch<FarmResponse>(`/farms/${id}`, updates);
  }
}
