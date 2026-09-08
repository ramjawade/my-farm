/**
 * Crops — a crop planted on a `Land`.
 *
 *   GET    /api/v1/crops        -> CursorPage<CropResponse>
 *   POST   /api/v1/crops        -> CropResponse   (201)
 *   PATCH  /api/v1/crops/{id}   -> CropResponse
 *   DELETE /api/v1/crops/{id}   -> 204
 *
 * `crop_catalog_id` is an FK into the seeded reference table —
 * `ReferenceDataService` resolves it to/from the client's free-text
 * `cropType`. Hand-written, frontend-owned (issue #49).
 */

import { AuditFields, IsoDate } from './common.contract';

export interface CropResponse extends AuditFields {
  id: string;
  farmer_id: string;
  land_id: string;
  crop_catalog_id: string;
  label: string | null;
  area: number | null;
  area_unit: string;
  season: string | null;
  sowing_date: IsoDate | null;
  current_stage: string | null;
  status: string;
  expected_harvest_date: IsoDate | null;
}

export interface CropCreateRequest {
  land_id: string;
  crop_catalog_id: string;
  label?: string | null;
  area?: number | null;
  area_unit?: string;
  season?: string | null;
  sowing_date?: IsoDate | null;
  current_stage?: string | null;
  status?: string;
  expected_harvest_date?: IsoDate | null;
}

export interface CropUpdateRequest {
  label?: string | null;
  area?: number | null;
  area_unit?: string;
  season?: string | null;
  sowing_date?: IsoDate | null;
  current_stage?: string | null;
  status?: string;
  expected_harvest_date?: IsoDate | null;
}
