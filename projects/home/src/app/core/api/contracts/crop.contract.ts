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
 * `cropType`.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: CropRead, CropCreate, CropUpdate.
 */

import type { components } from './generated/openapi-schema';

export type CropResponse = components['schemas']['CropRead'];
export type CropCreateRequest = components['schemas']['CropCreate'];
export type CropUpdateRequest = components['schemas']['CropUpdate'];
