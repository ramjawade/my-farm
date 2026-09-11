import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';
import { IStorageService } from '../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        { provide: IStorageService, useClass: InMemoryStorageService },
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

  describe('addActivity', () => {
    it('should add an activity with the id minted by storage', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
        cropId: 1,
      });

      expect(typeof activity.id).toBe('number');
      expect(activity.type).toBe('Sowing');
      expect(service.activities().length).toBe(1);
      expect(service.getActivityById(activity.id)).toEqual(activity);
    });

    it('should persist a new activity through the storage service', async () => {
      const storage = TestBed.inject(IStorageService) as InMemoryStorageService;
      await service.addActivity({
        date: Date.now(),
        type: 'Irrigation',
        status: 'Completed',
      });

      expect(storage.activities.length).toBe(1);
    });
  });

  describe('updateActivity', () => {
    it('should update an activity', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        type: 'Sowing',
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
        type: 'Sowing',
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        category: 'Labour',
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
        type: 'Sowing',
        status: 'Completed',
        cropId: 1,
      });

      await service.addActivity({
        date: Date.now(),
        type: 'Irrigation',
        status: 'Completed',
        cropId: 2,
      });

      const cropActivities = service.getActivitiesForCrop(1);
      expect(cropActivities.length).toBe(1);
      expect(cropActivities[0].type).toBe('Sowing');
    });
  });

  describe('getExpensesForActivity', () => {
    it('should fetch expenses for an activity', async () => {
      const activity = await service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        category: 'Labour',
        amount: 500,
      });

      await service.addExpense({
        activityId: activity.id,
        category: 'Seeds',
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
        type: 'Sowing',
        status: 'Completed',
      });

      await service.addExpense({
        activityId: activity.id,
        category: 'Labour',
        amount: 500,
      });

      await service.addExpense({
        activityId: activity.id,
        category: 'Seeds',
        amount: 300,
      });

      const total = service.getTotalExpenseForActivity(activity.id);
      expect(total).toBe(800);
    });
  });
});
