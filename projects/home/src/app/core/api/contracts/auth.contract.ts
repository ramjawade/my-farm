/**
 * PIN session auth (issue #45) — consumed by `SessionAuthService`.
 *
 *   GET  /api/v1/auth/lookup?phone=   -> PhoneLookupResponse
 *   POST /api/v1/auth/session         -> SessionResponse   (401 on bad creds)
 *   POST /api/v1/auth/register        -> SessionResponse   (409 if phone taken)
 *
 * Hand-written, frontend-owned (issue #49).
 */

import { FarmerResponse } from './farmer.contract';

export interface PhoneLookupResponse {
  exists: boolean;
}

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
