/**
 * Crop sales — produce sold from a crop, nested under it.
 *
 *   GET    /api/v1/crops/{cid}/sales        -> { items: CropSaleResponse[] }
 *   POST   /api/v1/crops/{cid}/sales        -> CropSaleResponse   (201)
 *   PATCH  /api/v1/crops/{cid}/sales/{id}   -> CropSaleResponse
 *   DELETE /api/v1/crops/{cid}/sales/{id}   -> 204
 *
 * The owning `crop_id` is always taken from the URL path; the create body
 * doesn't carry it. Decimals arrive as strings or numbers.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: CropSaleRead, CropSaleCreate, CropSaleUpdate.
 */

import type { components } from './generated/openapi-schema';

export type CropSaleResponse = components['schemas']['CropSaleRead'];
export type CropSaleCreateRequest = components['schemas']['CropSaleCreate'];
export type CropSaleUpdateRequest = components['schemas']['CropSaleUpdate'];
