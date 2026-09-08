import { Injectable } from '@angular/core';
import { CacheRecord, OutboxEntityType, OutboxRecord, SyncMeta } from './outbox.models';

const DB_NAME = 'my-farm-outbox';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const CACHE_STORE = 'cache';
const META_STORE = 'sync_meta';

/**
 * Thin wrapper over the native IndexedDB API — no library, per
 * BACKEND_PLAN.md §8.1's "IndexedDB stores — `outbox` (pending mutations)
 * and `cache` (last-known server state)". Every method here is
 * self-contained (opens its own transaction) so callers never have to
 * think about IDBDatabase lifecycles.
 */
@Injectable({ providedIn: 'root' })
export class OutboxDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
            const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'key' });
            store.createIndex('byFarmer', 'farmerId');
          }
          if (!db.objectStoreNames.contains(CACHE_STORE)) {
            const store = db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
            store.createIndex('byFarmerAndType', ['farmerId', 'entityType']);
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'farmerId' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(name, mode).objectStore(name);
  }

  private wrap<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Outbox ----

  async addOutboxRecord(record: OutboxRecord): Promise<void> {
    const store = await this.store(OUTBOX_STORE, 'readwrite');
    await this.wrap(store.put(record));
  }

  /** Pending + failed records for a farmer, oldest first — failed records
   * are retried on the next drain rather than abandoned. */
  async listOutboxRecords(farmerId: string): Promise<OutboxRecord[]> {
    const store = await this.store(OUTBOX_STORE, 'readonly');
    const index = store.index('byFarmer');
    const all = await this.wrap(index.getAll(farmerId) as IDBRequest<OutboxRecord[]>);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async countPending(farmerId: string): Promise<number> {
    const records = await this.listOutboxRecords(farmerId);
    return records.length;
  }

  async removeOutboxRecord(key: string): Promise<void> {
    const store = await this.store(OUTBOX_STORE, 'readwrite');
    await this.wrap(store.delete(key));
  }

  async markOutboxFailed(key: string, error: string): Promise<void> {
    const store = await this.store(OUTBOX_STORE, 'readwrite');
    const record = await this.wrap(store.get(key) as IDBRequest<OutboxRecord | undefined>);
    if (record) {
      record.status = 'failed';
      record.attempts += 1;
      record.lastError = error;
      await this.wrap(store.put(record));
    }
  }

  // ---- Cache ----

  async putCacheRecord(record: CacheRecord): Promise<void> {
    const store = await this.store(CACHE_STORE, 'readwrite');
    await this.wrap(store.put(record));
  }

  async getCacheRecord(
    farmerId: string,
    entityType: OutboxEntityType,
    entityId: string,
  ): Promise<CacheRecord | undefined> {
    const store = await this.store(CACHE_STORE, 'readonly');
    return this.wrap(
      store.get(`${farmerId}:${entityType}:${entityId}`) as IDBRequest<CacheRecord | undefined>,
    );
  }

  async listCacheRecords(farmerId: string, entityType: OutboxEntityType): Promise<CacheRecord[]> {
    const store = await this.store(CACHE_STORE, 'readonly');
    const index = store.index('byFarmerAndType');
    return this.wrap(
      index.getAll(IDBKeyRange.only([farmerId, entityType])) as IDBRequest<CacheRecord[]>,
    );
  }

  // ---- Sync watermark ----

  async getWatermark(farmerId: string): Promise<string | null> {
    const store = await this.store(META_STORE, 'readonly');
    const meta = await this.wrap(store.get(farmerId) as IDBRequest<SyncMeta | undefined>);
    return meta?.watermark ?? null;
  }

  async setWatermark(farmerId: string, watermark: string): Promise<void> {
    const store = await this.store(META_STORE, 'readwrite');
    const meta: SyncMeta = { farmerId, watermark };
    await this.wrap(store.put(meta));
  }
}
