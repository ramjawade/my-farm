import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';
import { ActivitiesApiService } from '../../core/api/activities-api.service';
import { FakeActivitiesApiService } from '../../testing/fake-activities-api.service';
import { HttpService } from '../../core/http/http.service';
import { Activity } from './activity.models';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
      ],
    });
    localStorage.clear();
    service = TestBed.inject(ActivityService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('reload', () => {
    function spyOnFetch(): jasmine.Spy {
      const storage = TestBed.inject(ActivitiesApiService) as unknown as FakeActivitiesApiService;
      return spyOn(storage, 'getActivities').and.callThrough();
    }

    it('should share one request between overlapping reloads', async () => {
      const fetch = spyOnFetch();

      await Promise.all([service.reload(), service.reload(), service.reload()]);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch again once the previous load has finished', async () => {
      const fetch = spyOnFetch();

      await service.reload();
      await service.reload();

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not reuse a load that started before a mutation', async () => {
      const fetch = spyOnFetch();

      const first = service.reload();
      await service.addActivity({ date: Date.now(), activityTypeId: 1, status: 'Completed' });
      await Promise.all([first, service.reload()]);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('queryActivitiesPage', () => {
    let get: jasmine.Spy;

    beforeEach(() => {
      get = jasmine.createSpy('get').and.resolveTo({
        items: [{ id: 1, activity_type_id: 1, status: 'Scheduled' }],
        cursor: 'next',
        has_more: true,
      });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
          { provide: HttpService, useValue: { get } },
        ],
      });
      service = TestBed.inject(ActivityService);
    });

    it('builds the query string from filters, sort, limit and cursor', async () => {
      await service.queryActivitiesPage({
        status: ['Scheduled', 'In Progress'],
        sort: 'cost_desc',
        limit: 20,
        cropId: 3,
        season: 'Kharif',
        landId: 8,
        activityTypeId: 2,
        cursor: 'a b/c',
      });

      expect(get).toHaveBeenCalledOnceWith(
        '/activities?status=Scheduled&status=In%20Progress&sort=cost_desc&limit=20&crop_id=3' +
          '&season=Kharif&land_id=8&activity_type_id=2&cursor=a%20b%2Fc',
      );
    });

    it('returns the mapped rows with the next cursor and has_more', async () => {
      const page = await service.queryActivitiesPage({ limit: 20 });

      expect(page.items.map((a) => a.id)).toEqual([1]);
      expect(page.cursor).toBe('next');
      expect(page.hasMore).toBeTrue();
    });

    it('treats an older API response without paging fields as the last page', async () => {
      get.and.resolveTo({ items: [] });

      const page = await service.queryActivitiesPage({});

      expect(page).toEqual({ items: [], cursor: null, hasMore: false });
    });

    it('queryActivities still returns just the rows', async () => {
      expect((await service.queryActivities({ limit: 5 })).length).toBe(1);
    });
  });

  describe('load interrupted by a mutation', () => {
    it('drops the stale result instead of overwriting the newer state', async () => {
      const storage = TestBed.inject(ActivitiesApiService) as unknown as FakeActivitiesApiService;
      let release!: (rows: Activity[]) => void;
      spyOn(storage, 'getActivities').and.returnValue(
        new Promise<Activity[]>((resolve) => (release = resolve)),
      );

      const loading = service.reload(); // a (possibly multi-page) load is in flight...
      const saved = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
      }); // ...and the farmer saves something
      release([]); // the stale load resolves without the new row
      await loading;

      expect(service.activities().map((a) => a.id)).toEqual([saved.id]);
    });
  });

  describe('addActivity', () => {
    it('should add an activity with the id minted by storage', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
        cropId: 1,
      });

      expect(typeof activity.id).toBe('number');
      expect(activity.activityTypeId).toBe(1);
      expect(service.activities().length).toBe(1);
      expect(service.getActivityById(activity.id)).toEqual(activity);
    });

    it('should persist a new activity through the storage service', async () => {
      const storage = TestBed.inject(ActivitiesApiService) as unknown as FakeActivitiesApiService;
      await service.addActivity({
        date: Date.now(),
        activityTypeId: 2,
        status: 'Completed',
      });

      expect(storage.activities.length).toBe(1);
    });
  });

  describe('updateActivity', () => {
    it('should update an activity', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Draft',
      });

      service.updateActivity(activity.id, { status: 'Completed' });
      const updated = service.getActivityById(activity.id);
      expect(updated?.status).toBe('Completed');
    });
  });

  describe('deleteActivity', () => {
    it('should delete an activity and its expenses', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        expenseCategoryId: 2,
        amount: 500,
      });

      service.deleteActivity(activity.id);
      expect(service.activities().length).toBe(0);
      expect(service.expenses().length).toBe(0);
    });
  });

  describe('getActivitiesForCrop', () => {
    it('should filter activities by crop', async () => {
      await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
        cropId: 1,
      });

      await service.addActivity({
        date: Date.now(),
        activityTypeId: 2,
        status: 'Completed',
        cropId: 2,
      });

      const cropActivities = service.getActivitiesForCrop(1);
      expect(cropActivities.length).toBe(1);
      expect(cropActivities[0].activityTypeId).toBe(1);
    });
  });

  describe('getExpensesForActivity', () => {
    it('should fetch expenses for an activity', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        expenseCategoryId: 2,
        amount: 500,
      });

      await service.addExpense({
        activityId: activity.id,
        expenseCategoryId: 3,
        amount: 300,
      });

      const expenses = service.getExpensesForActivity(activity.id);
      expect(expenses.length).toBe(2);
    });
  });

  describe('getTotalExpenseForActivity', () => {
    it('should sum expenses for an activity', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        expenseCategoryId: 2,
        amount: 500,
      });

      await service.addExpense({
        activityId: activity.id,
        expenseCategoryId: 3,
        amount: 300,
      });

      const total = service.getTotalExpenseForActivity(activity.id);
      expect(total).toBe(800);
    });
  });
});
