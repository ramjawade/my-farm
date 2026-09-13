/**
 * Farmer profile — `GET /api/v1/me`.
 *
 * Also the shape nested as `farmer` inside the auth endpoints' responses
 * (see `auth.contract.ts`).
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: FarmerRead, FarmerUpdate.
 */

import type { components } from './generated/openapi-schema';

export type FarmerResponse = components['schemas']['FarmerRead'];
export type FarmerUpdateRequest = components['schemas']['FarmerUpdate'];
