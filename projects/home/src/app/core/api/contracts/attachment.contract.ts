/**
 * Activity attachments — photos/files on an activity, stored by key.
 *
 *   GET    /api/v1/activities/{aid}/attachments         -> CursorPage<AttachmentResponse>
 *   POST   /api/v1/activities/{aid}/attachments         -> AttachmentResponse   (201)
 *   DELETE /api/v1/activities/{aid}/attachments/{id}    -> 204
 *
 * Not called by the frontend yet — the R2 upload flow is Stage 7 / a later
 * phase. Included here so that work starts from a written contract.
 * Hand-written, frontend-owned (issue #49).
 */

import { AuditFields } from './common.contract';

export interface AttachmentResponse extends AuditFields {
  id: number;
  activity_id: number;
  storage_key: string;
  content_type: string | null;
  size_bytes: number | null;
}

/** `ActivityAttachmentCreate` — no `activity_id` (it's in the path). */
export interface AttachmentCreateRequest {
  storage_key: string;
  content_type?: string | null;
  size_bytes?: number | null;
}
