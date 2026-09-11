/**
 * Farmer profile — `GET /api/v1/me`.
 *
 * Hand-written, frontend-owned (issue #49). Also the shape nested as
 * `farmer` inside the auth endpoints' responses (see `auth.contract.ts`).
 */

import { AuditFields } from './common.contract';

/** `FarmerRead` — the current authenticated farmer. */
export interface FarmerResponse extends AuditFields {
  id: number;
  auth_uid: string;
  user_role: string;
  full_name: string | null;
  email: string | null;
  preferred_language: string;
  phone: string | null;
}

/** `FarmerUpdate` — profile fields the farmer can edit (no endpoint wired yet). */
export interface FarmerUpdateRequest {
  full_name?: string | null;
  email?: string | null;
  preferred_language?: string | null;
}
