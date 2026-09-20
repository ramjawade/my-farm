import { Injectable } from '@angular/core';
import { HttpService } from '../http/http.service';
import { CropEntity, NewCrop } from '../../features/crop-timeline/crop-timeline.models';
import { CropMapperService } from '../../features/crop-timeline/crop-mapper.service';

/**
 * Crops, backed by the MyFarm backend via Firebase-authenticated HTTP
 * requests. Online-only — no offline outbox.
 *
 * Mapping between the Angular model and the backend schema delegates to
 * `CropMapperService` (`providedIn: 'root'`, shared with the targeted-fetch
 * services) so `crop_catalog_id` <-> name resolution lives in one place.
 */
@Injectable({ providedIn: 'root' })
export class CropsApiService {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private httpService: HttpService,
    private cropMapper: CropMapperService,
  ) {}

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.writeQueue.then(() => fn());
    this.writeQueue = promise.catch(() => {
      // Continue the queue even if this write fails
    });
    return promise;
  }

  async getCrops(userId: number): Promise<CropEntity[]> {
    try {
      const resp = await this.httpService.get<{ items: unknown[] }>('/crops');
      return await Promise.all(resp.items.map((item) => this.cropMapper.fromBackend(item)));
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
}
