/**
 * Activity attachments — photos/files on an activity, stored by key.
 *
 *   GET    /api/v1/activities/{aid}/attachments         -> CursorPage<AttachmentResponse>
 *   POST   /api/v1/activities/{aid}/attachments         -> AttachmentResponse   (201)
 *   DELETE /api/v1/activities/{aid}/attachments/{id}    -> 204
 *   POST   /api/v1/activities/{aid}/attachments/upload-url -> AttachmentUploadResponse
 *
 * Not called by the frontend yet — the R2 upload flow is Stage 7 / a later
 * phase. Included here so that work starts from a written contract.
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: ActivityAttachmentRead, ActivityAttachmentCreate, ActivityAttachmentUploadRequest, ActivityAttachmentUploadResponse.
 */

import type { components } from './generated/openapi-schema';

export type AttachmentResponse = components['schemas']['ActivityAttachmentRead'];
export type AttachmentCreateRequest = components['schemas']['ActivityAttachmentCreate'];
export type AttachmentUploadRequest = components['schemas']['ActivityAttachmentUploadRequest'];
export type AttachmentUploadResponse = components['schemas']['ActivityAttachmentUploadResponse'];
