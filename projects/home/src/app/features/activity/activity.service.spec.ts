import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';
import { Activity } from './activity.models';
import { IStorageService } from '../../core/storage/storage.interface';
import { LocalStorageService } from '../../core/storage/local-storage.service';
import { flushPromises } from '../../testing/flush-promises';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: IStorageService, useClass: LocalStorageService },
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
    it('should add an activity', () => {
      const activity = service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
        cropId: 'crop_1',
      });

      expect(activity.id).toBeDefined();
      expect(activity.type).toBe('Sowing');
      expect(service.activities().length).toBe(1);
    });

    it('should persist to localStorage', async () => {
      service.addActivity({
        date: Date.now(),
        type: 'Irrigation',
        status: 'Completed',
      });
      await flushPromises();

      const stored = JSON.parse(localStorage.getItem('my_farm_anonymous_activities') || '[]');
      expect(stored.length).toBe(1);
    });
  });

  describe('updateActivity', () => {
    it('should update an activity', () => {
      const activity = service.addActivity({
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
    it('should delete an activity and its expenses', () => {
      const activity = service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
      });

      service.addExpense({
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
    it('should filter activities by crop', () => {
      service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
        cropId: 'crop_1',
      });

      service.addActivity({
        date: Date.now(),
        type: 'Irrigation',
        status: 'Completed',
        cropId: 'crop_2',
      });

      const cropActivities = service.getActivitiesForCrop('crop_1');
      expect(cropActivities.length).toBe(1);
      expect(cropActivities[0].type).toBe('Sowing');
    });
  });

  describe('getExpensesForActivity', () => {
    it('should fetch expenses for an activity', () => {
      const activity = service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
      });

      service.addExpense({
        activityId: activity.id,
        category: 'Labour',
        amount: 500,
      });

      service.addExpense({
        activityId: activity.id,
        category: 'Seeds',
        amount: 300,
      });

      const expenses = service.getExpensesForActivity(activity.id);
      expect(expenses.length).toBe(2);
    });
  });

  describe('getTotalExpenseForActivity', () => {
    it('should sum expenses for an activity', () => {
      const activity = service.addActivity({
        date: Date.now(),
        type: 'Sowing',
        status: 'Completed',
      });

      service.addExpense({
        activityId: activity.id,
        category: 'Labour',
        amount: 500,
      });

      service.addExpense({
        activityId: activity.id,
        category: 'Seeds',
        amount: 300,
      });

      const total = service.getTotalExpenseForActivity(activity.id);
      expect(total).toBe(800);
    });
  });
});
