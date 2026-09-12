import { Injectable, inject } from '@angular/core';
import { HttpService } from '../../../core/http/http.service';
import { CropMapperService } from '../crop-mapper.service';
import { CropEntity, NewCrop } from '../crop-timeline.models';

/**
 * Crop lookup + creation for the add-crop form. Hits `/api/v1/crops`
 * directly through `HttpService` — no cache, no shared state, and no
 * dependency on the wider `IStorageService`/`ApiStorageService` layer.
 */
@Injectable({
  providedIn: 'root',
})
export class AddCropService {
  private readonly http = inject(HttpService);
  private readonly cropMapper = inject(CropMapperService);

  /** Load the current farmer's crops (used for name suggestions). */
  async getCrops(): Promise<CropEntity[]> {
    const response = await this.http.get<{ items: unknown[] }>('/crops');
    return Promise.all(response.items.map((item) => this.cropMapper.fromBackend(item)));
  }

  async createCrop(data: NewCrop): Promise<CropEntity> {
    const payload = await this.cropMapper.toBackend(data);
    const response = await this.http.post<unknown>('/crops', payload);
    // TODO: seed one activity per lifecycle stage (CROP_STAGES) here, like
    // CropTimelineService.addCrop() does today — deferred, revisit separately.
    return this.cropMapper.fromBackend(response);
  }
}
