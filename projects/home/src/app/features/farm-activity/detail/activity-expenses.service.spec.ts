import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivityExpensesService } from './activity-expenses.service';
import { ActivityMapperService } from '../../../core/api/activity-mapper.service';
import { EnvironmentService } from '../../../core/services/environment.service';
import { ActivityExpense } from '../../activity/activity.models';

describe('ActivityExpensesService', () => {
  let service: ActivityExpensesService;
  let httpMock: HttpTestingController;
  let mapper: jasmine.SpyObj<ActivityMapperService>;

  const apiUrl = 'https://api.test';
  const mappedExpense: ActivityExpense = {
    id: 1,
    activityId: 5,
    category: 'Seeds',
    amount: 500,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    mapper = jasmine.createSpyObj('ActivityMapperService', [
      'expenseFromBackend',
      'expenseToBackend',
    ]);
    mapper.expenseFromBackend.and.resolveTo(mappedExpense);
    mapper.expenseToBackend.and.resolveTo({ expense_category_id: 5, amount: 500 });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivityMapperService, useValue: mapper },
        { provide: EnvironmentService, useValue: { getApiUrl: () => apiUrl } },
      ],
    });

    service = TestBed.inject(ActivityExpensesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches and maps the expenses for an activity', async () => {
    const promise = service.getExpenses(5);
    const req = httpMock.expectOne(`${apiUrl}/activities/5/expenses`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 1 }] });

    expect(await promise).toEqual([mappedExpense]);
  });

  it('adds an expense', async () => {
    const promise = service.addExpense(5, { category: 'Seeds', amount: 500 });
    // `expenseToBackend` resolves asynchronously before the request is made.
    await Promise.resolve();
    const req = httpMock.expectOne(`${apiUrl}/activities/5/expenses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ expense_category_id: 5, amount: 500 });
    req.flush({ id: 1 });

    expect(await promise).toEqual(mappedExpense);
  });

  it('updates an expense', async () => {
    const promise = service.updateExpense(5, 1, { amount: 250 });
    await Promise.resolve();
    const req = httpMock.expectOne(`${apiUrl}/activities/5/expenses/1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 1 });

    expect(await promise).toEqual(mappedExpense);
  });

  it('deletes an expense', async () => {
    const promise = service.deleteExpense(5, 1);
    const req = httpMock.expectOne(`${apiUrl}/activities/5/expenses/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await promise;
  });
});
