/**
 * Offline sync protocol (BACKEND_PLAN.md §8.2) — used by `OutboxStorageService`.
 *
 *   POST /api/v1/sync/push                         -> SyncPushResponse
 *   GET  /api/v1/sync/pull?since=&cursor=&limit=   -> SyncPullResponse
 *
 * The server upserts push items by their client-minted UUIDv7 primary key,
 * so replaying a batch after a dropped connection is a no-op. Hand-written,
 * frontend-owned (issue #49).
 */

/** Entity types the sync endpoints accept. The outbox only enqueues the
 * last three; `farms` is resolved eagerly and never queued. */
export type SyncEntityType = 'farms' | 'lands' | 'crops' | 'activities';

export type SyncOperation = 'create' | 'update' | 'delete';

/** One queued mutation. `payload` is the same body the matching
 * `POST`/`PATCH` endpoint would take (built by `ApiStorageService`'s
 * `mapToBackend*`); ignored for `delete`. */
export interface SyncPushItem {
  entity_type: SyncEntityType;
  id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
}

export interface SyncPushRequest {
  operations: SyncPushItem[];
}

/** Per-item outcome — one bad item never fails the rest of the batch. */
export interface SyncPushResultItem {
  entity_type: SyncEntityType;
  id: string;
  operation: SyncOperation;
  status: 'ok' | 'error';
  /** The upserted row on `status: 'ok'` for create/update. */
  entity?: Record<string, unknown> | null;
  error_code?: string | null;
  message?: string | null;
}

export interface SyncPushResponse {
  results: SyncPushResultItem[];
}

export interface SyncPullParams {
  /** ISO timestamp watermark; ignored once `cursor` is present. */
  since?: string;
  cursor?: string;
  limit?: number;
}

/** One entity type's slice of a pull window. */
export interface SyncEntityPage {
  items: Record<string, unknown>[];
  has_more: boolean;
}

export interface SyncPullResponse {
  entities: Partial<Record<SyncEntityType, SyncEntityPage>>;
  /** Non-null while any entity type still has more of this window to drain. */
  next_cursor: string | null;
  server_time: string;
}
