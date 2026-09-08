import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IStorageService } from '../storage/storage.interface';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { CropEntity } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { BackupFile } from '../storage/backup.models';
import { ApiStorageService } from '../api/api-storage.service';
import { OutboxDbService } from './outbox-db.service';
import { CacheRecord, OutboxEntityType, OutboxOperation, OutboxRecord } from './outbox.models';

interface SyncPushResultItem {
  entity_type: OutboxEntityType;
  id: string;
  operation: OutboxOperation;
  status: 'ok' | 'error';
  entity?: Record<string, unknown>;
  error_code?: string;
  message?: string;
}

interface WithId {
  id: string;
}

const PUSH_BATCH_SIZE = 50;
const BACKGROUND_DRAIN_INTERVAL_MS = 30_000;

/**
 * Offline outbox (BACKEND_PLAN.md §5, Stage 5): wraps `ApiStorageService`
 * and adds a local-first write path for the three entity types
 * `/api/v1/sync/push` covers (lands/crops/activities — "farms" and
 * "expenses" in Angular's own vocabulary stay pass-through, see below).
 *
 * Design: every write to a covered entity type is enqueued into an
 * IndexedDB `outbox` store and applied to an IndexedDB `cache` store
 * immediately — the caller gets an optimistic result without waiting on
 * the network, matching every other IStorageService implementation's
 * contract. A drain runs opportunistically after every write, on the
 * browser's `online` event, and on a 30s timer while online; it POSTs
 * batches to `/sync/push` and is safe to interrupt or retry (the backend
 * upserts by the client-minted id, so a batch replayed after a dropped
 * connection is a no-op — BACKEND_PLAN.md §8.2).
 *
 * Reads try the network first (so a connected device always sees the
 * latest cross-device state) and fall back to the local cache — merged
 * with anything still in the outbox — when offline.
 *
 * Deliberately out of scope, matching ApiStorageService's own gaps:
 * expenses (no `/sync/*` coverage yet), weather, farmer profile, backup.
 * Those pass straight through to the wrapped ApiStorageService and simply
 * fail like any other network call when offline.
 */
@Injectable({ providedIn: 'root' })
export class OutboxStorageService extends IStorageService {
  private readonly apiStorage = inject(ApiStorageService);
  private readonly db = inject(OutboxDbService);
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/v1';
  private token: string | null = null;

  /** Farmer ids currently mid-drain, so a timer tick and an `online` event
   * firing at once don't push the same batch twice. */
  private readonly draining = new Set<string>();
  private backgroundTimer: ReturnType<typeof setInterval> | null = null;
  private lastKnownFarmerId: string | null = null;

  /** Outstanding (pending or failed) outbox entries for the last farmer
   * this service touched — for a small "N changes waiting to sync" badge. */
  readonly pendingCount = signal(0);

  constructor() {
    super();
    window.addEventListener('online', () => this.onConnectivityRestored());
  }

  setAuthToken(token: string | null): void {
    this.token = token;
    this.apiStorage.setAuthToken(token);
  }

  private getHeaders(): HttpHeaders {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return new HttpHeaders(headers);
  }

  private onConnectivityRestored(): void {
    if (this.lastKnownFarmerId) {
      void this.tryDrain(this.lastKnownFarmerId);
    }
  }

  private noteFarmer(farmerId: string): void {
    this.lastKnownFarmerId = farmerId;
    if (!this.backgroundTimer) {
      this.backgroundTimer = setInterval(() => {
        if (this.lastKnownFarmerId) void this.tryDrain(this.lastKnownFarmerId);
      }, BACKGROUND_DRAIN_INTERVAL_MS);
    }
    // Deliberately not refreshing pendingCount here: enqueue() and
    // tryDrain() both already do, and firing a third concurrent read
    // transaction against the same IndexedDB store here raced with those
    // (observed as a hung `getAll()` request under Chrome headless).
  }

  private async refreshPendingCount(farmerId: string): Promise<void> {
    this.pendingCount.set(await this.db.countPending(farmerId));
  }

  // ============================================================================
  // Activities (outbox-covered)
  // ============================================================================

  async getActivities(userId: string): Promise<Activity[]> {
    this.noteFarmer(userId);
    try {
      const fresh = await this.apiStorage.getActivities(userId);
      await this.refreshCache(userId, 'activities', fresh as unknown as WithId[]);
      return this.mergeWithPending(userId, 'activities', fresh);
    } catch (error) {
      console.warn('getActivities: offline, serving from local cache', error);
      return this.readCache<Activity>(userId, 'activities');
    }
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    this.noteFarmer(userId);
    const id = crypto.randomUUID();
    const now = Date.now();
    const local: Activity = { ...activity, id, createdAt: now, updatedAt: now };
    const payload = await this.apiStorage.mapToBackendActivity(local);
    await this.cachePut(userId, 'activities', id, local as unknown as Record<string, unknown>);
    await this.enqueue(userId, 'activities', id, 'create', payload);
    return local;
  }

  async updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void> {
    this.noteFarmer(userId);
    const payload = await this.apiStorage.mapToBackendActivity(updates);
    await this.cacheMerge(userId, 'activities', id, { ...updates, updatedAt: Date.now() });
    await this.enqueue(userId, 'activities', id, 'update', payload);
  }

  async deleteActivity(userId: string, id: string): Promise<void> {
    this.noteFarmer(userId);
    await this.cacheMarkDeleted(userId, 'activities', id);
    await this.enqueue(userId, 'activities', id, 'delete', {});
  }

  async syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]> {
    const activities = await this.getActivities(userId);
    return activities.filter((a) => a.fieldId === fieldId);
  }

  // ============================================================================
  // Crops (outbox-covered)
  // ============================================================================

  async getCrops(userId: string): Promise<CropEntity[]> {
    this.noteFarmer(userId);
    try {
      const fresh = await this.apiStorage.getCrops(userId);
      await this.refreshCache(userId, 'crops', fresh as unknown as WithId[]);
      return this.mergeWithPending(userId, 'crops', fresh);
    } catch (error) {
      console.warn('getCrops: offline, serving from local cache', error);
      return this.readCache<CropEntity>(userId, 'crops');
    }
  }

  async saveCrop(userId: string, crop: CropEntity): Promise<CropEntity> {
    this.noteFarmer(userId);
    const id = crypto.randomUUID();
    const local: CropEntity = { ...crop, id };
    const payload = await this.apiStorage.mapToBackendCrop(local);
    await this.cachePut(userId, 'crops', id, local as unknown as Record<string, unknown>);
    await this.enqueue(userId, 'crops', id, 'create', payload);
    return local;
  }

  async updateCrop(userId: string, id: string, updates: Partial<CropEntity>): Promise<void> {
    this.noteFarmer(userId);
    const payload = await this.apiStorage.mapToBackendCrop(updates);
    await this.cacheMerge(userId, 'crops', id, updates as Record<string, unknown>);
    await this.enqueue(userId, 'crops', id, 'update', payload);
  }

  async deleteCrop(userId: string, id: string): Promise<void> {
    this.noteFarmer(userId);
    await this.cacheMarkDeleted(userId, 'crops', id);
    await this.enqueue(userId, 'crops', id, 'delete', {});
  }

  // ============================================================================
  // Farms / lands (outbox-covered; geometry stays local, see class doc)
  // ============================================================================

  async getFarms(userId: string): Promise<SavedFarm[]> {
    this.noteFarmer(userId);
    try {
      const fresh = await this.apiStorage.getFarms(userId);
      await this.refreshCache(userId, 'lands', fresh as unknown as WithId[]);
      return this.mergeWithPending(userId, 'lands', fresh);
    } catch (error) {
      console.warn('getFarms: offline, serving from local cache', error);
      return this.readCache<SavedFarm>(userId, 'lands');
    }
  }

  async saveFarm(userId: string, farm: SavedFarm): Promise<SavedFarm> {
    this.noteFarmer(userId);
    const id = crypto.randomUUID();
    const local: SavedFarm = { ...farm, id, createdAt: Date.now() };
    const farmId = await this.apiStorage.getOrCreateDefaultFarmId();
    const payload = this.apiStorage.mapToBackendLand(local, farmId);
    await this.cachePut(userId, 'lands', id, local as unknown as Record<string, unknown>);
    await this.enqueue(userId, 'lands', id, 'create', payload);
    return local;
  }

  async updateFarm(userId: string, id: string, updates: Partial<SavedFarm>): Promise<void> {
    this.noteFarmer(userId);
    const payload = this.apiStorage.mapToBackendLand(updates);
    await this.cacheMerge(userId, 'lands', id, updates as Record<string, unknown>);
    await this.enqueue(userId, 'lands', id, 'update', payload);
  }

  async deleteFarm(userId: string, id: string): Promise<void> {
    this.noteFarmer(userId);
    await this.cacheMarkDeleted(userId, 'lands', id);
    await this.enqueue(userId, 'lands', id, 'delete', {});
  }

  // ============================================================================
  // Pass-through: expenses (no /sync/* coverage), farmer, weather, backup
  // ============================================================================

  getExpenses(userId: string): Promise<ActivityExpense[]> {
    return this.apiStorage.getExpenses(userId);
  }
  saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    return this.apiStorage.saveExpense(userId, expense);
  }
  updateExpense(userId: string, id: string, updates: Partial<ActivityExpense>): Promise<void> {
    return this.apiStorage.updateExpense(userId, id, updates);
  }
  deleteExpense(userId: string, id: string): Promise<void> {
    return this.apiStorage.deleteExpense(userId, id);
  }
  syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]> {
    return this.apiStorage.syncExpensesForActivity(userId, activityId);
  }
  getFarmerById(id: string): Promise<FarmerRegistrationData | undefined> {
    return this.apiStorage.getFarmerById(id);
  }
  getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    return this.apiStorage.getFarmerByPhone(phone);
  }
  saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData> {
    return this.apiStorage.saveFarmer(farmer);
  }
  getWeatherHistory(userId: string): Promise<WeatherData[]> {
    return this.apiStorage.getWeatherHistory(userId);
  }
  saveWeatherSnapshot(userId: string, snapshot: WeatherData): Promise<WeatherData> {
    return this.apiStorage.saveWeatherSnapshot(userId, snapshot);
  }
  exportUserData(userId: string): Promise<BackupFile> {
    return this.apiStorage.exportUserData(userId);
  }
  importUserData(userId: string, backup: BackupFile): Promise<void> {
    return this.apiStorage.importUserData(userId, backup);
  }
  clearUserData(userId: string): Promise<void> {
    return this.apiStorage.clearUserData(userId);
  }

  // ============================================================================
  // Cache helpers
  // ============================================================================

  private async cachePut(
    farmerId: string,
    entityType: OutboxEntityType,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const record: CacheRecord = {
      key: `${farmerId}:${entityType}:${id}`,
      farmerId,
      entityType,
      entityId: id,
      data,
      deleted: false,
    };
    await this.db.putCacheRecord(record);
  }

  private async cacheMerge(
    farmerId: string,
    entityType: OutboxEntityType,
    id: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.db.getCacheRecord(farmerId, entityType, id);
    await this.cachePut(farmerId, entityType, id, { ...(existing?.data ?? {}), ...updates, id });
  }

  private async cacheMarkDeleted(
    farmerId: string,
    entityType: OutboxEntityType,
    id: string,
  ): Promise<void> {
    const existing = await this.db.getCacheRecord(farmerId, entityType, id);
    const record: CacheRecord = {
      key: `${farmerId}:${entityType}:${id}`,
      farmerId,
      entityType,
      entityId: id,
      data: existing?.data ?? { id },
      deleted: true,
    };
    await this.db.putCacheRecord(record);
  }

  private async readCache<T>(farmerId: string, entityType: OutboxEntityType): Promise<T[]> {
    const records = await this.db.listCacheRecords(farmerId, entityType);
    return records.filter((r) => !r.deleted).map((r) => r.data as unknown as T);
  }

  /** Write fresh server data into the cache, skipping any entity with an
   * unsynced outbox record (that local edit is newer than what the server
   * just returned) and — for lands — preserving the locally-drawn polygon
   * the server has nowhere to store. */
  private async refreshCache(
    farmerId: string,
    entityType: OutboxEntityType,
    freshItems: WithId[],
  ): Promise<void> {
    const pendingIds = new Set(
      (await this.db.listOutboxRecords(farmerId))
        .filter((r) => r.entityType === entityType)
        .map((r) => r.entityId),
    );
    for (const item of freshItems as unknown as Record<string, unknown>[]) {
      const id = item['id'] as string;
      if (pendingIds.has(id)) continue;
      let data = item;
      if (entityType === 'lands') {
        const existing = await this.db.getCacheRecord(farmerId, entityType, id);
        if (existing) {
          data = { ...item, points: existing.data['points'], geoJson: existing.data['geoJson'] };
        }
      }
      await this.cachePut(farmerId, entityType, id, data);
    }
  }

  /** Server list, with outbox-pending deletes hidden and outbox-pending
   * creates (not yet echoed back by the server) appended from the cache. */
  private async mergeWithPending<T extends WithId>(
    farmerId: string,
    entityType: OutboxEntityType,
    serverItems: T[],
  ): Promise<T[]> {
    const pending = (await this.db.listOutboxRecords(farmerId)).filter(
      (r) => r.entityType === entityType,
    );
    const pendingByEntity = new Map(pending.map((r) => [r.entityId, r]));
    const serverIds = new Set(serverItems.map((item) => item.id));

    const result = serverItems.filter(
      (item) => pendingByEntity.get(item.id)?.operation !== 'delete',
    );

    for (const record of pending) {
      if (record.operation === 'create' && !serverIds.has(record.entityId)) {
        const cached = await this.db.getCacheRecord(farmerId, entityType, record.entityId);
        if (cached && !cached.deleted) {
          result.push(cached.data as unknown as T);
        }
      }
    }
    return result;
  }

  // ============================================================================
  // Outbox drain
  // ============================================================================

  private async enqueue(
    farmerId: string,
    entityType: OutboxEntityType,
    entityId: string,
    operation: OutboxOperation,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const record: OutboxRecord = {
      key: `${farmerId}:${entityType}:${entityId}:${Date.now()}`,
      farmerId,
      entityType,
      entityId,
      operation,
      payload,
      createdAt: Date.now(),
      status: 'pending',
      attempts: 0,
    };
    await this.db.addOutboxRecord(record);
    await this.refreshPendingCount(farmerId);
    void this.tryDrain(farmerId);
  }

  private async tryDrain(farmerId: string): Promise<void> {
    if (!navigator.onLine || this.draining.has(farmerId)) return;
    this.draining.add(farmerId);
    try {
      await this.drainOnce(farmerId);
    } catch (error) {
      console.warn('Outbox drain failed, will retry later:', error);
    } finally {
      this.draining.delete(farmerId);
      await this.refreshPendingCount(farmerId);
    }
  }

  private async drainOnce(farmerId: string): Promise<void> {
    const records = await this.db.listOutboxRecords(farmerId);
    if (records.length === 0) return;

    for (let i = 0; i < records.length; i += PUSH_BATCH_SIZE) {
      const batch = records.slice(i, i + PUSH_BATCH_SIZE);
      const operations = batch.map((r) => ({
        entity_type: r.entityType,
        id: r.entityId,
        operation: r.operation,
        payload: r.payload,
      }));

      let response: { results: SyncPushResultItem[] };
      try {
        response = await firstValueFrom(
          this.http.post<{ results: SyncPushResultItem[] }>(
            `${this.baseUrl}/sync/push`,
            { operations },
            { headers: this.getHeaders() },
          ),
        );
      } catch {
        // Network-level failure — leave everything from here on queued and
        // stop; the next online event or timer tick retries the batch.
        return;
      }

      for (let j = 0; j < batch.length; j++) {
        await this.applyPushResult(farmerId, batch[j], response.results[j]);
      }
    }
  }

  private async applyPushResult(
    farmerId: string,
    record: OutboxRecord,
    result: SyncPushResultItem | undefined,
  ): Promise<void> {
    if (result?.status === 'ok') {
      await this.db.removeOutboxRecord(record.key);
      if (result.entity && record.operation !== 'delete') {
        await this.mergeServerEntityIntoCache(
          farmerId,
          record.entityType,
          record.entityId,
          result.entity,
        );
      }
      return;
    }
    // A conflict or validation error is not going to fix itself on retry
    // with the same payload, but we still keep the record (marked failed,
    // visible via pendingCount) rather than silently dropping a farmer's
    // data — a future edit to the same entity produces a fresh outbox
    // record that can succeed independently.
    await this.db.markOutboxFailed(record.key, result?.message ?? 'sync failed');
  }

  private async mergeServerEntityIntoCache(
    farmerId: string,
    entityType: OutboxEntityType,
    entityId: string,
    backendEntity: Record<string, unknown>,
  ): Promise<void> {
    let data: Record<string, unknown>;
    if (entityType === 'activities') {
      data = (await this.apiStorage.mapFromBackendActivity(backendEntity)) as unknown as Record<
        string,
        unknown
      >;
    } else if (entityType === 'crops') {
      data = (await this.apiStorage.mapFromBackendCrop(backendEntity)) as unknown as Record<
        string,
        unknown
      >;
    } else {
      const mapped = this.apiStorage.mapFromBackendLand(backendEntity) as unknown as Record<
        string,
        unknown
      >;
      const existing = await this.db.getCacheRecord(farmerId, entityType, entityId);
      data = existing
        ? { ...mapped, points: existing.data['points'], geoJson: existing.data['geoJson'] }
        : mapped;
    }
    await this.cachePut(farmerId, entityType, entityId, data);
  }
}
