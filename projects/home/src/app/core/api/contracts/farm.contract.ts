/**
 * Farms — the top-level holding a farmer's `Land` plots hang off.
 *
 *   GET   /api/v1/farms          -> CursorPage<FarmResponse>
 *   GET   /api/v1/farms/{id}     -> FarmResponse
 *   POST  /api/v1/farms          -> FarmResponse   (201)
 *   PATCH /api/v1/farms/{id}     -> FarmResponse
 *   DELETE /api/v1/farms/{id}    -> 204
 *
 * The Angular app has no multi-farm UI — `ApiStorageService` only
 * get-or-creates one default farm to satisfy `Land.farm_id`. Hand-written,
 * frontend-owned (issue #49).
 */

import { AuditFields } from './common.contract';

export interface FarmResponse extends AuditFields {
  id: string;
  farmer_id: string;
  name: string;
  area: number | null;
  area_unit: string;
  water_source: string | null;
  irrigation_type: string | null;
  farming_method: string | null;
  location_type: string | null;
  state: string | null;
  district: string | null;
  village: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  setup_completed: boolean;
}

/** `FarmCreate` — `name` is the only field the app ever sends. */
export interface FarmCreateRequest {
  name: string;
  area?: number | null;
  area_unit?: string;
  water_source?: string | null;
  irrigation_type?: string | null;
  farming_method?: string | null;
  location_type?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type FarmUpdateRequest = Partial<FarmCreateRequest>;
