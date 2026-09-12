import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivityMapperService } from './activity-mapper.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';

describe('ActivityMapperService', () => {
  let service: ActivityMapperService;
  let referenceData: jasmine.SpyObj<ReferenceDataService>;

  beforeEach(() => {
    referenceData = jasmine.createSpyObj('ReferenceDataService', [
      'activityTypeNameForId',
      'activityTypeIdForName',
      'expenseCategoryNameForId',
      'expenseCategoryIdForName',
    ]);
    referenceData.activityTypeNameForId.and.resolveTo('Irrigation');
    referenceData.activityTypeIdForName.and.resolveTo(3);
    referenceData.expenseCategoryNameForId.and.resolveTo('Seeds');
    referenceData.expenseCategoryIdForName.and.resolveTo(5);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ReferenceDataService, useValue: referenceData },
      ],
    });

    service = TestBed.inject(ActivityMapperService);
  });

  it('maps a backend activity item to the Angular model', async () => {
    const activity = await service.fromBackend({
      id: 10,
      activity_type_id: 3,
      status: 'pending',
      date: '2026-09-08',
      created_at: '2026-09-08T00:00:00Z',
      updated_at: '2026-09-08T01:00:00Z',
    });

    expect(activity.id).toBe(10);
    expect(activity.type).toBe('Irrigation');
    expect(activity.status).toBe('pending');
    expect(referenceData.activityTypeNameForId).toHaveBeenCalledWith(3);
  });

  it('maps an activity update back to backend field names', async () => {
    const payload = await service.toBackend({
      type: 'Irrigation' as any,
      status: 'completed' as any,
    });

    expect(payload['activity_type_id']).toBe(3);
    expect(payload['status']).toBe('completed');
  });

  it('maps a backend expense item to the Angular model', async () => {
    const expense = await service.expenseFromBackend({
      id: 1,
      activity_id: 10,
      expense_category_id: 5,
      amount: '500.00',
      created_at: '2026-09-08T00:00:00Z',
    });

    expect(expense.category).toBe('Seeds');
    expect(expense.amount).toBe(500);
    expect(expense.activityId).toBe(10);
  });

  it('maps an expense update back to backend field names', async () => {
    const payload = await service.expenseToBackend({ category: 'Seeds', amount: 250 });

    expect(payload['expense_category_id']).toBe(5);
    expect(payload['amount']).toBe(250);
  });
});
