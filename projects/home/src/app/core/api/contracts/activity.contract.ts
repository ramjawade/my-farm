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
 * contract modules. Hand-written, frontend-owned (issue #49).
 */

import { AuditFields, IsoDate } from './common.contract';

export interface ActivityResponse extends AuditFields {
  id: string;
  farmer_id: string;
  activity_type_id: string;
  crop_id: string | null;
  land_id: string | null;
  parent_activity_id: string | null;
  custom_activity_name: string | null;
  date: IsoDate | null;
  season: string | null;
  status: string;
  notes: string | null;
  activity_meta: Record<string, unknown> | null;
}

export interface ActivityCreateRequest {
  activity_type_id: string;
  crop_id?: string | null;
  land_id?: string | null;
  parent_activity_id?: string | null;
  custom_activity_name?: string | null;
  date?: IsoDate | null;
  season?: string | null;
  status?: string;
  notes?: string | null;
  activity_meta?: Record<string, unknown> | null;
}

export type ActivityUpdateRequest = Partial<ActivityCreateRequest>;
