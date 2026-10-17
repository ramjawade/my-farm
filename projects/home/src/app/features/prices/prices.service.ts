import { Injectable, inject } from '@angular/core';
import {
  LatestPricesResponse,
  MandiResponse,
  MyMandisResponse,
  PriceHistoryResponse,
} from '../../core/api/contracts';
import { HttpService } from '../../core/http/http.service';

export interface MandiFilters {
  district?: string;
  q?: string;
  commodity?: string;
  limit?: number;
}

export type HistoryDays = 7 | 30 | 365;

/** Mandi prices as stored by the backend (fetched daily by the runner in India). Read-only. */
@Injectable({ providedIn: 'root' })
export class PricesService {
  private readonly http = inject(HttpService);

  /** Each of the farmer's crops with its latest price at every followed mandi. */
  latest(): Promise<LatestPricesResponse> {
    return this.http.get<LatestPricesResponse>('/prices/latest');
  }

  /** A commodity's daily price at one mandi, oldest first, with the period's figures. */
  history(mandiId: number, commodity: string, days: HistoryDays): Promise<PriceHistoryResponse> {
    return this.http.get<PriceHistoryResponse>('/prices/history', {
      mandi_id: String(mandiId),
      commodity,
      days: String(days),
    });
  }

  /** The mandis the farmer follows, or the suggested defaults for their district. */
  myMandis(): Promise<MyMandisResponse> {
    return this.http.get<MyMandisResponse>('/me/mandis');
  }

  saveMandis(mandiIds: number[]): Promise<MyMandisResponse> {
    return this.http.put<MyMandisResponse>('/me/mandis', { mandi_ids: mandiIds });
  }

  async districts(): Promise<string[]> {
    const resp = await this.http.get<{ items: string[] }>('/mandis/districts');
    return resp.items;
  }

  async findMandis(filters: MandiFilters = {}): Promise<MandiResponse[]> {
    const params: Record<string, string> = {};
    if (filters.district) params['district'] = filters.district;
    if (filters.q?.trim()) params['q'] = filters.q.trim();
    if (filters.commodity) params['commodity'] = filters.commodity;
    if (filters.limit) params['limit'] = String(filters.limit);
    const resp = await this.http.get<{ items: MandiResponse[] }>('/mandis', params);
    return resp.items;
  }
}
