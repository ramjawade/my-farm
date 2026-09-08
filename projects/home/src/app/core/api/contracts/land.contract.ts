/**
 * Lands — a drawn plot of land (Angular calls this a `SavedFarm`).
 *
 *   GET    /api/v1/lands        -> CursorPage<LandResponse>
 *   POST   /api/v1/lands        -> LandResponse   (201)
 *   PATCH  /api/v1/lands/{id}   -> LandResponse
 *   DELETE /api/v1/lands/{id}   -> 204
 *
 * The polygon itself (`points` / `geoJson` on the client) has no backend
 * column yet — only `area_sq_m` round-trips. Hand-written, frontend-owned
 * (issue #49).
 */

import { AuditFields } from './common.contract';

export interface LandResponse extends AuditFields {
  id: string;
  farmer_id: string;
  farm_id: string;
  name: string;
  area_sq_m: number | null;
  notes: string | null;
}

/** `LandCreate` — `farm_id` is the default farm resolved by `ApiStorageService`. */
export interface LandCreateRequest {
  name: string;
  farm_id: string;
  area_sq_m?: number | null;
  notes?: string | null;
}

export interface LandUpdateRequest {
  name?: string;
  area_sq_m?: number | null;
  notes?: string | null;
}
