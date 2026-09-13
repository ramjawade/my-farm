/**
 * PIN session auth (issues #45, #50) — consumed by `SessionAuthService`.
 *
 *   POST /api/v1/auth/session    -> SessionResponse
 *                                   404 = no account for that phone (offer register)
 *                                   401 = account exists, wrong PIN
 *   POST /api/v1/auth/register   -> SessionResponse   (409 if phone already taken)
 *
 * Auth is online-only — there is no offline path and no local fallback.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: SessionRequest, RegisterRequest, SessionResponse.
 */

import type { components } from './generated/openapi-schema';

export type SessionRequest = components['schemas']['SessionRequest'];
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type SessionResponse = components['schemas']['SessionResponse'];
