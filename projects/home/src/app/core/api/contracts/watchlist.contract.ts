/**
 * Watchlists — named lists of crop-at-market items, each with its latest price.
 *
 *   GET    /api/v1/watchlists                      -> WatchlistsResponse
 *   POST   /api/v1/watchlists                      -> WatchlistResponse      (201)
 *   DELETE /api/v1/watchlists/{id}                 -> 204
 *   POST   /api/v1/watchlists/{id}/items           -> WatchlistItemResponse  (201)
 *   DELETE /api/v1/watchlists/{id}/items/{item_id} -> 204
 *
 * Refusals use a short code in the problem title: `name_taken`, `reserved_name`,
 * `list_limit` (10 lists), `item_limit` (20 items), `duplicate_item` (409), and
 * `crop_has_no_price` (422).
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: Watchlists, WatchlistRead, WatchlistItemRead, WatchlistCreate, WatchlistItemCreate.
 */

import type { components } from './generated/openapi-schema';

export type WatchlistsResponse = components['schemas']['Watchlists'];
export type WatchlistResponse = components['schemas']['WatchlistRead'];
export type WatchlistItemResponse = components['schemas']['WatchlistItemRead'];
export type WatchlistCreateRequest = components['schemas']['WatchlistCreate'];
export type WatchlistItemCreateRequest = components['schemas']['WatchlistItemCreate'];
