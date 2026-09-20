import { Injectable } from '@angular/core';
import { HttpService } from '../http/http.service';
import { SavedFarm, FarmAreaResult, NewSavedFarm, LatLngPoint } from '../../map/models/map.models';
import { toGeoJsonPolygon } from '../../map/farm-draw/farm-area.utils';

const SQ_M_PER_HECTARE = 10_000;
const SQ_M_PER_ACRE = 4_046.8564224;
const EMPTY_AREA: FarmAreaResult = { squareMeters: 0, hectares: 0, acres: 0 };

/**
 * Lands (drawn farm plots — the app calls them "farms"), backed by the
 * MyFarm backend via Firebase-authenticated HTTP requests. Online-only —
 * no offline outbox.
 *
 * `Land.farm_id` is required, but `SavedFarm` (a plot) has no concept of the
 * top-level `Farm` the backend also tracks — the app has never had a
 * multi-farm model. `getOrCreateDefaultFarmId` resolves a single default
 * Farm per farmer, cached in memory for the lifetime of this service.
 */
@Injectable({ providedIn: 'root' })
export class LandsApiService {
  private defaultFarmIdPromise: Promise<number> | null = null;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private httpService: HttpService) {}

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.writeQueue.then(() => fn());
    this.writeQueue = promise.catch(() => {
      // Continue the queue even if this write fails
    });
    return promise;
  }

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

  async getFarms(userId: number): Promise<SavedFarm[]> {
    try {
      const resp = await this.httpService.get<{ items: unknown[] }>('/lands');
      return resp.items.map((item) => this.mapFromBackendLand(item));
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
        return this.mapFromBackendLand(response);
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

  private mapFromBackendLand(item: any): SavedFarm {
    const squareMeters =
      item.area_sq_m !== null && item.area_sq_m !== undefined ? Number(item.area_sq_m) : undefined;
    const points: LatLngPoint[] = Array.isArray(item.points)
      ? item.points.map((p: { lat: number | string; lng: number | string }) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
        }))
      : [];
    return {
      id: item.id,
      name: item.name,
      points,
      area:
        squareMeters !== undefined
          ? {
              squareMeters,
              hectares: squareMeters / SQ_M_PER_HECTARE,
              acres: squareMeters / SQ_M_PER_ACRE,
            }
          : EMPTY_AREA,
      geoJson: points.length >= 3 ? toGeoJsonPolygon(points) : null,
      createdAt: new Date(item.created_at).getTime(),
      notes: item.notes ?? undefined,
    };
  }

  private mapToBackendLand(farm: Partial<SavedFarm>, farmId?: number): Record<string, unknown> {
    return {
      name: farm.name,
      farm_id: farmId,
      area_sq_m: farm.area?.squareMeters,
      notes: farm.notes,
      points: farm.points?.map((p) => ({ lat: p.lat, lng: p.lng })),
    };
  }
}
