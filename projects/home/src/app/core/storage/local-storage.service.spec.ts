import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  const userId = 'test-user-1';

  const mockActivity: Activity = {
    id: 'act-1',
    date: Date.now(),
    type: 'Irrigation',
    season: 'Kharif',
    fieldId: 'field-1',
    status: 'Completed',
    notes: 'Test activity',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockExpense: ActivityExpense = {
    id: 'exp-1',
    activityId: 'act-1',
    category: 'Labour',
    amount: 500,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocalStorageService],
    });
    service = TestBed.inject(LocalStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should save and retrieve activities', async () => {
    await service.saveActivity(userId, mockActivity);
    const activities = await service.getActivities(userId);

    expect(activities.length).toBe(1);
    expect(activities[0].id).toBe('act-1');
    expect(activities[0].type).toBe('Irrigation');
  });

  it('should return empty array for non-existent activities', async () => {
    const activities = await service.getActivities('non-existent-user');
    expect(activities).toEqual([]);
  });

  it('should save and retrieve expenses', async () => {
    await service.saveExpense(userId, mockExpense);
    const expenses = await service.getExpenses(userId);

    expect(expenses.length).toBe(1);
    expect(expenses[0].id).toBe('exp-1');
    expect(expenses[0].amount).toBe(500);
  });

  it('should return empty array for non-existent expenses', async () => {
    const expenses = await service.getExpenses('non-existent-user');
    expect(expenses).toEqual([]);
  });

  it('should update an activity', async () => {
    await service.saveActivity(userId, mockActivity);
    await service.updateActivity(userId, 'act-1', {
      notes: 'Updated notes',
      status: 'In Progress',
    });

    const activities = await service.getActivities(userId);
    expect(activities[0].notes).toBe('Updated notes');
    expect(activities[0].status).toBe('In Progress');
    expect(activities[0].type).toBe('Irrigation');
  });

  it('should update an expense', async () => {
    await service.saveExpense(userId, mockExpense);
    await service.updateExpense(userId, 'exp-1', { amount: 750 });

    const expenses = await service.getExpenses(userId);
    expect(expenses[0].amount).toBe(750);
  });

  it('should delete an activity', async () => {
    await service.saveActivity(userId, mockActivity);
    await service.deleteActivity(userId, 'act-1');

    const activities = await service.getActivities(userId);
    expect(activities.length).toBe(0);
  });

  it('should delete an expense', async () => {
    await service.saveExpense(userId, mockExpense);
    await service.deleteExpense(userId, 'exp-1');

    const expenses = await service.getExpenses(userId);
    expect(expenses.length).toBe(0);
  });

  it('should sync activities for a field', async () => {
    const act2: Activity = {
      ...mockActivity,
      id: 'act-2',
      fieldId: 'field-2',
    };

    await service.saveActivity(userId, mockActivity);
    await service.saveActivity(userId, act2);

    const fieldActivities = await service.syncActivitiesForField(userId, 'field-1');

    expect(fieldActivities.length).toBe(1);
    expect(fieldActivities[0].fieldId).toBe('field-1');
  });

  it('should sync expenses for an activity', async () => {
    const exp2: ActivityExpense = {
      ...mockExpense,
      id: 'exp-2',
      activityId: 'act-2',
    };

    await service.saveExpense(userId, mockExpense);
    await service.saveExpense(userId, exp2);

    const activityExpenses = await service.syncExpensesForActivity(userId, 'act-1');

    expect(activityExpenses.length).toBe(1);
    expect(activityExpenses[0].activityId).toBe('act-1');
  });

  it('should isolate data per user', async () => {
    const user2 = 'test-user-2';
    const act2: Activity = { ...mockActivity, id: 'act-2' };

    await service.saveActivity(userId, mockActivity);
    await service.saveActivity(user2, act2);

    const user1Activities = await service.getActivities(userId);
    const user2Activities = await service.getActivities(user2);

    expect(user1Activities.length).toBe(1);
    expect(user2Activities.length).toBe(1);
    expect(user1Activities[0].id).toBe('act-1');
    expect(user2Activities[0].id).toBe('act-2');
  });

  it('should persist data in localStorage', async () => {
    await service.saveActivity(userId, mockActivity);

    const key = `my_farm_${userId}_activities`;
    const stored = localStorage.getItem(key);

    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].id).toBe('act-1');
  });
});
