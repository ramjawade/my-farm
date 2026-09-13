/**
 * Activities — a logged farm activity (sowing, spraying, harvest, …).
 *
 *   GET    /api/v1/activities        -> CursorPage<ActivityResponse>
 *   GET    /api/v1/activities/{id}   -> ActivityResponse
 *   POST   /api/v1/activities        -> ActivityResponse   (201)
 *   PATCH  /api/v1/activities/{id}   -> ActivityResponse
 *   DELETE /api/v1/activities/{id}   -> 204
 *
 * `activity_type_id` is an FK into the seeded reference table, resolved by
 * `ReferenceDataService`. Nested expenses/attachments live in their own
 * contract modules.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: ActivityRead, ActivityCreate, ActivityUpdate.
 */

import type { components } from './generated/openapi-schema';

export type ActivityResponse = components['schemas']['ActivityRead'];
export type ActivityCreateRequest = components['schemas']['ActivityCreate'];
export type ActivityUpdateRequest = components['schemas']['ActivityUpdate'];
