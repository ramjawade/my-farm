import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivityMapperService } from './activity-mapper.service';

describe('ActivityMapperService', () => {
  let service: ActivityMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    service = TestBed.inject(ActivityMapperService);
  });

  it('maps a backend activity item to the Angular model', () => {
    const activity = service.fromBackend({
      id: 10,
      activity_type_id: 3,
      status: 'pending',
      date: '2026-09-08',
      created_at: '2026-09-08T00:00:00Z',
      updated_at: '2026-09-08T01:00:00Z',
    });

    expect(activity.id).toBe(10);
    expect(activity.activityTypeId).toBe(3);
    expect(activity.status).toBe('pending');
  });

  it('maps an activity update back to backend field names', () => {
    const payload = service.toBackend({
      activityTypeId: 3,
      status: 'completed' as any,
    });

    expect(payload['activity_type_id']).toBe(3);
    expect(payload['status']).toBe('completed');
  });

  it('maps a backend expense item to the Angular model', () => {
    const expense = service.expenseFromBackend({
      id: 1,
      activity_id: 10,
      expense_category_id: 5,
      amount: '500.00',
      created_at: '2026-09-08T00:00:00Z',
    });

    expect(expense.expenseCategoryId).toBe(5);
    expect(expense.amount).toBe(500);
    expect(expense.activityId).toBe(10);
  });

  it('maps an expense update back to backend field names', () => {
    const payload = service.expenseToBackend({ expenseCategoryId: 5, amount: 250 });

    expect(payload['expense_category_id']).toBe(5);
    expect(payload['amount']).toBe(250);
  });
});
