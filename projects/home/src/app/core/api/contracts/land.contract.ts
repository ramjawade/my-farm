/**
 * Lands — a drawn plot of land (Angular calls this a `SavedFarm`).
 *
 *   GET    /api/v1/lands        -> CursorPage<LandResponse>
 *   POST   /api/v1/lands        -> LandResponse   (201)
 *   PATCH  /api/v1/lands/{id}   -> LandResponse
 *   DELETE /api/v1/lands/{id}   -> 204
 *
 * The polygon itself (`points` / `geoJson` on the client) has no backend
 * column yet — only `area_sq_m` round-trips (see #193).
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: LandRead, LandCreate, LandUpdate.
 */

import type { components } from './generated/openapi-schema';

export type LandResponse = components['schemas']['LandRead'];
export type LandCreateRequest = components['schemas']['LandCreate'];
export type LandUpdateRequest = components['schemas']['LandUpdate'];
