import { Injectable, inject } from '@angular/core';
import {
  CropSaleCreateRequest,
  CropSaleResponse,
  CropSaleUpdateRequest,
} from '../../../core/api/contracts';
import { HttpService } from '../../../core/http/http.service';
import { CropSale, CropSaleInput } from './crop-sale.models';

/** Sales of one crop, over `/crops/{id}/sales`. Online-only, one call per change. */
@Injectable({ providedIn: 'root' })
export class CropSalesService {
  private readonly http = inject(HttpService);

  async list(cropId: number): Promise<CropSale[]> {
    const resp = await this.http.get<{ items: CropSaleResponse[] }>(`/crops/${cropId}/sales`);
    return resp.items.map(fromBackend);
  }

  async add(cropId: number, input: CropSaleInput): Promise<CropSale> {
    const created = await this.http.post<CropSaleResponse>(
      `/crops/${cropId}/sales`,
      toBackend(input),
    );
    return fromBackend(created);
  }

  async update(cropId: number, saleId: number, input: CropSaleInput): Promise<CropSale> {
    const updated = await this.http.patch<CropSaleResponse>(
      `/crops/${cropId}/sales/${saleId}`,
      toBackend(input),
    );
    return fromBackend(updated);
  }

  async remove(cropId: number, saleId: number): Promise<void> {
    await this.http.delete(`/crops/${cropId}/sales/${saleId}`);
  }
}

function fromBackend(r: CropSaleResponse): CropSale {
  return {
    id: r.id,
    cropId: r.crop_id,
    soldOn: r.sold_on,
    quantity: Number(r.quantity),
    unit: r.unit,
    rate: Number(r.rate),
    amount: Number(r.amount),
    buyer: r.buyer ?? undefined,
    notes: r.notes ?? undefined,
  };
}

function toBackend(input: CropSaleInput): CropSaleCreateRequest & CropSaleUpdateRequest {
  return {
    sold_on: input.soldOn,
    quantity: input.quantity,
    unit: input.unit,
    rate: input.rate,
    amount: input.amount,
    buyer: input.buyer ?? null,
    notes: input.notes ?? null,
  };
}
