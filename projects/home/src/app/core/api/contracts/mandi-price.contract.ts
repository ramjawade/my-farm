/**
 * Mandi prices — mandis, the mandis a farmer follows, latest prices and history.
 *
 *   GET /api/v1/mandis/districts          -> { items: string[] }
 *   GET /api/v1/mandis?district=&q=&commodity=&limit=  -> { items: MandiResponse[] }
 *   GET /api/v1/me/mandis                 -> MyMandisResponse
 *   PUT /api/v1/me/mandis                 -> MyMandisResponse
 *   GET /api/v1/prices/latest             -> LatestPricesResponse
 *   GET /api/v1/prices/history?mandi_id=&commodity=&days=7|30|365 -> PriceHistoryResponse
 *
 * Prices are rupees per quintal. `suggested` is true while the followed
 * mandis are the district defaults and the farmer has not chosen any.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: MandiRead, MyMandisRead, MyMandisUpdate, MandiPrice, CropPrices, LatestPrices, PricePoint, PriceHistory.
 */

import type { components } from './generated/openapi-schema';

export type MandiResponse = components['schemas']['MandiRead'];
export type MyMandisResponse = components['schemas']['MyMandisRead'];
export type MyMandisUpdateRequest = components['schemas']['MyMandisUpdate'];
export type MandiPriceResponse = components['schemas']['MandiPrice'];
export type CropPricesResponse = components['schemas']['CropPrices'];
export type LatestPricesResponse = components['schemas']['LatestPrices'];
export type PricePointResponse = components['schemas']['PricePoint'];
export type PriceHistoryResponse = components['schemas']['PriceHistory'];
