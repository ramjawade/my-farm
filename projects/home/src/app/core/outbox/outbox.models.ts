/**
 * Backend entity types covered by `/api/v1/sync/push` and `/pull`
 * (BACKEND_PLAN.md §8) — the top-level farmer-owned entities that carry
 * their own `farmer_id`. Expenses/attachments and weather stay online-only
 * (see ApiStorageService's class doc for why).
 */
export type OutboxEntityType = 'lands' | 'crops' | 'activities';

export type OutboxOperation = 'create' | 'update' | 'delete';

export type OutboxStatus = 'pending' | 'syncing' | 'failed';

/** One queued mutation, keyed by the client-minted entity id it targets. */
export interface OutboxRecord {
  /** IndexedDB primary key: `${farmerId}:${entityType}:${entityId}:${createdAt}`. */
  key: string;
  farmerId: string;
  entityType: OutboxEntityType;
  entityId: string;
  operation: OutboxOperation;
  /** Already in backend shape (snake_case), built by ApiStorageService's
   * mapToBackend* mappers — the exact payload `/sync/push` expects. */
  payload: Record<string, unknown>;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
}

/** Last-known state of one entity, read-through cache for offline reads
 * and the source of the fields the backend has nowhere to store yet
 * (a land's drawn polygon — see ApiStorageService's class doc). */
export interface CacheRecord {
  /** `${farmerId}:${entityType}:${entityId}`. */
  key: string;
  farmerId: string;
  entityType: OutboxEntityType;
  entityId: string;
  /** Angular-shaped entity (Activity / CropEntity / SavedFarm), as `unknown`
   * because this store is generic across all three. */
  data: Record<string, unknown>;
  deleted: boolean;
}

/** Per-farmer sync/pull watermark. */
export interface SyncMeta {
  farmerId: string;
  watermark: string | null;
}
