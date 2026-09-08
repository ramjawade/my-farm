/**
 * PIN session auth (issues #45, #50) — consumed by `SessionAuthService`.
 *
 *   POST /api/v1/auth/session    -> SessionResponse
 *                                   404 = no account for that phone (offer register)
 *                                   401 = account exists, wrong PIN
 *   POST /api/v1/auth/register   -> SessionResponse   (409 if phone already taken)
 *
 * Auth is online-only — there is no offline path and no local fallback.
 * Hand-written, frontend-owned (issue #49).
 */

import { FarmerResponse } from './farmer.contract';

/** `SessionRequest` — body of `POST /auth/session`. */
export interface SessionRequest {
  phone: string;
  pin: string;
}

/** `RegisterRequest` — body of `POST /auth/register`. */
export interface RegisterRequest {
  phone: string;
  pin: string;
  full_name: string;
  preferred_language?: string;
}

/** `SessionResponse` — a freshly issued session JWT plus its farmer. */
export interface SessionResponse {
  token: string;
  farmer: FarmerResponse;
}
