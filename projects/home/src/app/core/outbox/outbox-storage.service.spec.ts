import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OutboxStorageService } from './outbox-storage.service';
import { OutboxDbService } from './outbox-db.service';
import { ApiStorageService } from '../api/api-storage.service';
import { Activity } from '../../features/activity/activity.models';
import { CacheRecord, OutboxRecord } from './outbox.models';

/**
 * In-memory fake for OutboxDbService. The real one is a thin IndexedDB
 * wrapper — worth trusting the browser for (see outbox-db.service.ts's own
 * comment) — so these specs exercise OutboxStorageService's actual unit of
 * behaviour (the drain, the optimistic cache, the convergence semantics)
 * against a synchronous, fully deterministic backing store instead.
 */
class FakeOutboxDbService {
  outbox = new Map<string, OutboxRecord>();
  cache = new Map<string, CacheRecord>();

  async addOutboxRecord(record: OutboxRecord): Promise<void> {
    this.outbox.set(record.key, record);
  }
  async listOutboxRecords(farmerId: string): Promise<OutboxRecord[]> {
    return [...this.outbox.values()]
      .filter((r) => r.farmerId === farmerId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  async countPending(farmerId: string): Promise<number> {
    return (await this.listOutboxRecords(farmerId)).length;
  }
  async removeOutboxRecord(key: string): Promise<void> {
    this.outbox.delete(key);
  }
  async markOutboxFailed(key: string, error: string): Promise<void> {
    const record = this.outbox.get(key);
    if (record) {
      record.status = 'failed';
      record.attempts += 1;
      record.lastError = error;
    }
  }
  async putCacheRecord(record: CacheRecord): Promise<void> {
    this.cache.set(record.key, record);
  }
  async getCacheRecord(
    farmerId: string,
    entityType: string,
    entityId: string,
  ): Promise<CacheRecord | undefined> {
    return this.cache.get(`${farmerId}:${entityType}:${entityId}`);
  }
  async listCacheRecords(farmerId: string, entityType: string): Promise<CacheRecord[]> {
    return [...this.cache.values()].filter(
      (r) => r.farmerId === farmerId && r.entityType === entityType,
    );
  }
  async getWatermark(): Promise<string | null> {
    return null;
  }
  async setWatermark(): Promise<void> {
    // no-op
  }
}

describe('OutboxStorageService', () => {
  let service: OutboxStorageService;
  let db: FakeOutboxDbService;
  let httpMock: HttpTestingController;
  let apiStorageSpy: jasmine.SpyObj<ApiStorageService>;
  let onLineSpy: jasmine.Spy;

  const farmerId = 'farmer-1';

  /** Post-flush() continuations chain through several `await`s
   * (drainOnce's loop, applyPushResult, mergeServerEntityIntoCache's own
   * mapFromBackendActivity call, tryDrain's finally) — enough microtask
   * ticks to let all of them settle before asserting on the result. */
  const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const baseActivity: Activity = {
    id: 'ignored-input-id',
    type: 'Irrigation',
    status: 'Completed',
    createdAt: 0,
    updatedAt: 0,
  };

  beforeEach(() => {
    apiStorageSpy = jasmine.createSpyObj<ApiStorageService>('ApiStorageService', [
      'getActivities',
      'mapToBackendActivity',
      'mapFromBackendActivity',
      'setAuthToken',
    ]);
    apiStorageSpy.mapToBackendActivity.and.callFake(async (a: Partial<Activity>) => ({
      activity_type_id: 'activity-type-irrigation',
      status: a.status,
    }));

    db = new FakeOutboxDbService();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiStorageService, useValue: apiStorageSpy },
        { provide: OutboxDbService, useValue: db },
      ],
    });

    service = TestBed.inject(OutboxStorageService);
    httpMock = TestBed.inject(HttpTestingController);

    // Force the background/opportunistic drain off so writes are
    // deterministic to assert on — each test flushes /sync/push itself.
    onLineSpy = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('queues a create optimistically without touching the network while offline', async () => {
    const saved = await service.saveActivity(farmerId, baseActivity);

    expect(saved.id).toBeTruthy();
    expect(saved.id).not.toBe('ignored-input-id');
    expect(saved.status).toBe('Completed');

    const pending = await db.listOutboxRecords(farmerId);
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('create');
    expect(pending[0].entityType).toBe('activities');
    expect(pending[0].entityId).toBe(saved.id);

    httpMock.expectNone(`/api/v1/sync/push`);
  });

  it('serves getActivities from the local cache when the network read fails', async () => {
    const saved = await service.saveActivity(farmerId, baseActivity);

    apiStorageSpy.getActivities.and.rejectWith(new Error('offline'));
    const activities = await service.getActivities(farmerId);

    expect(activities.some((a) => a.id === saved.id)).toBeTrue();
  });

  it('drains a queued create to /sync/push and converges — the outbox empties and the cache holds the server-canonical entity', async () => {
    onLineSpy.and.returnValue(true);
    apiStorageSpy.mapFromBackendActivity.and.callFake(
      async (item: any) =>
        ({
          id: item.id,
          type: 'Irrigation',
          status: item.status,
          createdAt: 1000,
          updatedAt: 2000,
        }) as Activity,
    );

    const saved = await service.saveActivity(farmerId, baseActivity);

    const req = httpMock.expectOne('/api/v1/sync/push');
    expect(req.request.body.operations.length).toBe(1);
    expect(req.request.body.operations[0].id).toBe(saved.id);
    expect(req.request.body.operations[0].operation).toBe('create');

    req.flush({
      results: [
        {
          entity_type: 'activities',
          id: saved.id,
          operation: 'create',
          status: 'ok',
          entity: { id: saved.id, status: 'Completed' },
        },
      ],
    });
    await flushMicrotasks();

    expect(await db.listOutboxRecords(farmerId)).toEqual([]);
    expect(service.pendingCount()).toBe(0);

    const cached = await db.getCacheRecord(farmerId, 'activities', saved.id);
    expect(cached?.data['updatedAt']).toBe(2000);
  });

  it('a batch replayed after a dropped connection is a no-op — the retry leaves the outbox exactly as drained', async () => {
    onLineSpy.and.returnValue(true);
    apiStorageSpy.mapFromBackendActivity.and.resolveTo({
      id: 'x',
      type: 'Irrigation',
      status: 'Completed',
      createdAt: 0,
      updatedAt: 0,
    } as Activity);

    const saved = await service.saveActivity(farmerId, baseActivity);
    const first = httpMock.expectOne('/api/v1/sync/push');
    first.flush({
      results: [
        {
          entity_type: 'activities',
          id: saved.id,
          operation: 'create',
          status: 'ok',
          entity: { id: saved.id, status: 'Completed' },
        },
      ],
    });
    await flushMicrotasks();

    expect(await db.listOutboxRecords(farmerId)).toEqual([]);

    // Nothing left to replay — draining again enqueues no second request.
    await (service as unknown as { tryDrain(id: string): Promise<void> }).tryDrain(farmerId);
    httpMock.expectNone('/api/v1/sync/push');
  });

  it('hides an item from getActivities while its delete is still pending, and drops the outbox record once the server confirms it', async () => {
    onLineSpy.and.returnValue(true);
    apiStorageSpy.mapFromBackendActivity.and.resolveTo({
      id: 'x',
      type: 'Irrigation',
      status: 'Completed',
      createdAt: 0,
      updatedAt: 0,
    } as Activity);

    const saved = await service.saveActivity(farmerId, baseActivity);
    httpMock.expectOne('/api/v1/sync/push').flush({
      results: [
        {
          entity_type: 'activities',
          id: saved.id,
          operation: 'create',
          status: 'ok',
          entity: { id: saved.id, status: 'Completed' },
        },
      ],
    });
    await flushMicrotasks();

    apiStorageSpy.getActivities.and.resolveTo([saved]);
    await service.deleteActivity(farmerId, saved.id);

    const listedWhilePending = await service.getActivities(farmerId);
    expect(listedWhilePending.some((a) => a.id === saved.id)).toBeFalse();

    httpMock.expectOne('/api/v1/sync/push').flush({
      results: [{ entity_type: 'activities', id: saved.id, operation: 'delete', status: 'ok' }],
    });
    await flushMicrotasks();

    expect(await db.listOutboxRecords(farmerId)).toEqual([]);
  });
});
