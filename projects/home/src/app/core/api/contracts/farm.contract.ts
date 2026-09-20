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
 * get-or-creates one default farm to satisfy `Land.farm_id`.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: FarmRead, FarmCreate, FarmUpdate.
 */

import type { components } from './generated/openapi-schema';

export type FarmResponse = components['schemas']['FarmRead'];
export type FarmCreateRequest = components['schemas']['FarmCreate'];
export type FarmUpdateRequest = components['schemas']['FarmUpdate'];
