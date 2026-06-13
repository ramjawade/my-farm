import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FarmActivityService } from './farm-activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { AuthService } from '../../core/auth/auth.service';
import { Activity } from './farm-activity.models';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';

describe('FarmActivityService', () => {
  let service: FarmActivityService;
  let authService: AuthService;
  let timelineService: CropTimelineService;

  const mockUser: FarmerRegistrationData = {
    id: 'f-test',
    fullName: 'Test Farmer',
    phone: '1234567890',
    preferredLanguage: 'English',
    userRole: 'Farmer',
    farmName: 'Test Farm',
    farmArea: 2.0,
    farmAreaUnit: 'hectares',
    primaryCrops: [],
    waterSource: 'Rainfed',
    irrigationType: 'Manual',
    farmingMethod: 'Organic',
    locationType: 'skipped',
    location: null,
    createdAt: Date.now()
  };

  const mockActivities = [
    {
      id: 'act-s-1',
      cropId: 'c1',
      type: 'Irrigation',
      date: 1000,
      status: 'Completed',
      cost: 500,
      notes: 'Notes',
      attachments: [],
      metadata: {}
    }
  ];

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthService,
        FarmActivityService,
        CropTimelineService
      ]
    });

    service = TestBed.inject(FarmActivityService);
    authService = TestBed.inject(AuthService);
    timelineService = TestBed.inject(CropTimelineService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should seed default data for f-default user when storage is empty', () => {
    authService.login({
      id: 'f-default',
      fullName: 'Default User',
      phone: '1234567890',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Default Farm',
      farmArea: 10,
      farmAreaUnit: 'hectares',
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now()
    });

    TestBed.flushEffects();

    expect(service.activities().length).toBeGreaterThan(0);
    expect(service.expenses().length).toBeGreaterThan(0);
  });

  it('should not seed data and clear signals when no user is logged in', () => {
    authService.logout();
    TestBed.flushEffects();

    expect(service.activities().length).toBe(0);
    expect(service.expenses().length).toBe(0);
  });

  it('should save and load activities for a specific user', () => {
    authService.login(mockUser);
    TestBed.flushEffects();

    const initialCount = service.activities().length;

    const activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> = {
      date: Date.now(),
      season: 'Kharif',
      activityId: 'Irrigation',
      fieldId: 'Field A',
      status: 'Completed',
      notes: 'Custom activity'
    };

    const newAct = service.addActivity(activityData);
    expect(newAct.id).toBeTruthy();
    expect(service.activities().length).toBe(initialCount + 1);

    const stored = localStorage.getItem(`my_farm_f-test_activities`);
    expect(stored).toContain(newAct.id);
  });

  it('should update an activity and save changes to localStorage', () => {
    authService.login(mockUser);
    TestBed.flushEffects();

    const activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> = {
      date: Date.now(),
      season: 'Kharif',
      activityId: 'Irrigation',
      fieldId: 'Field A',
      status: 'Completed',
      notes: 'Notes to update'
    };

    const created = service.addActivity(activityData);
    service.updateActivity(created.id, { notes: 'Updated notes', status: 'In Progress' });

    const updated = service.activities().find(a => a.id === created.id);
    expect(updated?.notes).toBe('Updated notes');
    expect(updated?.status).toBe('In Progress');

    const stored = localStorage.getItem(`my_farm_f-test_activities`);
    expect(stored).toContain('Updated notes');
  });

  it('should delete an activity and cascade delete associated expenses', () => {
    authService.login(mockUser);
    TestBed.flushEffects();

    const activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> = {
      date: Date.now(),
      season: 'Kharif',
      activityId: 'Irrigation',
      fieldId: 'Field A',
      status: 'Completed',
      notes: 'Notes to delete'
    };

    const created = service.addActivity(activityData);

    const expense = service.addExpense({
      activityId: created.id,
      category: 'Labour',
      amount: 120,
      remarks: 'Paid helper'
    });

    expect(service.getExpensesForActivity(created.id).length).toBe(1);
    expect(service.getTotalExpenseForActivity(created.id)).toBe(120);

    service.deleteActivity(created.id);

    expect(service.activities().find(a => a.id === created.id)).toBeUndefined();
    expect(service.getExpensesForActivity(created.id).length).toBe(0);
    expect(service.expenses().find(e => e.id === expense.id)).toBeUndefined();
  });

  it('should sync new activities, updates, and deletes to CropTimelineService', () => {
    authService.login(mockUser);
    TestBed.flushEffects();

    const cropId = 'c-test-crop-1';

    const activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> = {
      cropId,
      date: Date.now(),
      season: 'Rabi',
      activityId: 'Irrigation',
      fieldId: 'Field A',
      status: 'Completed',
      notes: 'Crop-linked activity'
    };

    const created = service.addActivity(activityData);

    let synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced).toBeTruthy();
    expect(synced?.cropId).toBe(cropId);
    expect(synced?.type).toBe('Irrigation');
    expect(synced?.status).toBe('Completed');

    service.updateActivity(created.id, { notes: 'Updated crop notes' });
    synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced?.notes).toBe('Updated crop notes');

    service.deleteActivity(created.id);
    synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced).toBeUndefined();
  });

  it('should handle expense modifications and sync cost updates to CropTimelineService', () => {
    authService.login(mockUser);
    TestBed.flushEffects();

    const cropId = 'c-test-crop-2';
    const activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> = {
      cropId,
      date: Date.now(),
      season: 'Rabi',
      activityId: 'Weeding',
      fieldId: 'Field A',
      status: 'Completed',
      notes: 'Expense test activity'
    };

    const created = service.addActivity(activityData);

    const exp1 = service.addExpense({
      activityId: created.id,
      category: 'Seeds',
      amount: 400
    });

    let synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced?.cost).toBe(400);

    const exp2 = service.addExpense({
      activityId: created.id,
      category: 'Labour',
      amount: 250
    });

    synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced?.cost).toBe(650);

    service.updateExpense(exp1.id, { amount: 500 });
    synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced?.cost).toBe(750);

    service.deleteExpense(exp2.id);
    synced = timelineService.activities().find(a => a.id === created.id);
    expect(synced?.cost).toBe(500);
  });
});
