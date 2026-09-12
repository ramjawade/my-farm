import { Injectable, inject } from '@angular/core';
import { HttpService } from '../../../core/http/http.service';
import { CropMapperService } from '../crop-mapper.service';
import { CropEntity } from '../crop-timeline.models';

/**
 * Read-only crop lookup for the dashboard. Hits `/api/v1/crops` directly
 * through `HttpService` — no cache, no shared state, and no dependency on
 * the wider `IStorageService`/`ApiStorageService` layer.
 */
@Injectable({
  providedIn: 'root',
})
export class CropDashboardService {
  private readonly http = inject(HttpService);
  private readonly cropMapper = inject(CropMapperService);

  /** Load the current farmer's crops. Errors propagate — the component shows its own error state. */
  async getCrops(): Promise<CropEntity[]> {
    const response = await this.http.get<{ items: unknown[] }>('/crops');
    return Promise.all(response.items.map((item) => this.cropMapper.fromBackend(item)));
  }
}
