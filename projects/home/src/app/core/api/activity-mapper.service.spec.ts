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

  it('maps the sale columns to a sale and back', () => {
    const activity = service.fromBackend({
      id: 11,
      activity_type_id: 9,
      status: 'Completed',
      sale_quantity: '12.00',
      sale_unit: 'crates',
      sale_rate: '1250.00',
      sale_amount: '15000.00',
      sale_buyer: 'Nashik APMC',
      created_at: '2026-10-02T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    });

    expect(activity.sale).toEqual({
      quantity: 12,
      unit: 'crates',
      rate: 1250,
      amount: 15000,
      buyer: 'Nashik APMC',
    });
    expect(service.toBackend(activity)).toEqual(
      jasmine.objectContaining({
        sale_quantity: 12,
        sale_unit: 'crates',
        sale_rate: 1250,
        sale_amount: 15000,
        sale_buyer: 'Nashik APMC',
      }),
    );
  });

  it('has no sale on an activity without sale columns, and sends none', () => {
    const activity = service.fromBackend({
      id: 12,
      activity_type_id: 3,
      status: 'Completed',
      sale_quantity: null,
      sale_unit: null,
      sale_rate: null,
      sale_amount: null,
      sale_buyer: null,
      created_at: '2026-10-02T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    });

    expect(activity.sale).toBeUndefined();
    expect(Object.keys(service.toBackend(activity))).not.toContain('sale_amount');
  });

  it('sends null for a sale figure the farmer cleared', () => {
    const payload = service.toBackend({ sale: { buyer: undefined, quantity: 5 } });

    expect(payload['sale_quantity']).toBe(5);
    expect(payload['sale_buyer']).toBeNull();
    expect(payload['sale_amount']).toBeNull();
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
