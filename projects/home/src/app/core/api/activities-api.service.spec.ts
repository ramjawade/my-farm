import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivitiesApiService } from './activities-api.service';
import { HttpService } from '../http/http.service';

interface Row {
  id: number;
  activity_type_id: number;
  status: string;
}

const row = (id: number): Row => ({ id, activity_type_id: 1, status: 'Scheduled' });
const rows = (from: number, count: number): Row[] =>
  Array.from({ length: count }, (_, i) => row(from + i));

describe('ActivitiesApiService paged loading', () => {
  let get: jasmine.Spy;
  let service: ActivitiesApiService;

  beforeEach(() => {
    get = jasmine.createSpy('get');
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: HttpService, useValue: { get } }],
    });
    service = TestBed.inject(ActivitiesApiService);
  });

  it('follows the cursor until has_more is false, 100 rows at a time', async () => {
    get.and.returnValues(
      Promise.resolve({ items: rows(1, 100), cursor: 'c1', has_more: true }),
      Promise.resolve({ items: rows(101, 100), cursor: 'c2', has_more: true }),
      Promise.resolve({ items: rows(201, 50), cursor: null, has_more: false }),
    );

    const activities = await service.getActivities(1);

    expect(activities.length).toBe(250);
    expect(activities.map((a) => a.id)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
    expect(get.calls.allArgs()).toEqual([
      ['/activities', { limit: '100' }],
      ['/activities', { limit: '100', cursor: 'c1' }],
      ['/activities', { limit: '100', cursor: 'c2' }],
    ]);
  });

  it('pages expenses the same way', async () => {
    const expense = (id: number) => ({
      id,
      activity_id: 1,
      expense_category_id: 1,
      amount: '5.00',
    });
    get.and.returnValues(
      Promise.resolve({ items: [expense(1), expense(2)], cursor: 'x', has_more: true }),
      Promise.resolve({ items: [expense(3)], cursor: null, has_more: false }),
    );

    const expenses = await service.getExpenses(1);

    expect(expenses.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(get.calls.argsFor(1)).toEqual(['/activities/expenses', { limit: '100', cursor: 'x' }]);
  });

  it('treats a response without has_more as complete', async () => {
    get.and.resolveTo({ items: rows(1, 3) });

    const activities = await service.getActivities(1);

    expect(activities.length).toBe(3);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches without a limit when a pre-pagination API truncated at the page size', async () => {
    get.and.returnValues(
      Promise.resolve({ items: rows(1, 100) }), // old API: limit acted as a cap, no has_more
      Promise.resolve({ items: rows(1, 130) }), // unpaginated request returns everything
    );

    const activities = await service.getActivities(1);

    expect(activities.length).toBe(130);
    expect(get.calls.argsFor(1)).toEqual(['/activities']);
  });

  it('stops at the page cap instead of looping forever', async () => {
    spyOn(console, 'error');
    get.and.callFake(() => Promise.resolve({ items: rows(1, 1), cursor: 'again', has_more: true }));

    const activities = await service.getActivities(1);

    expect(get).toHaveBeenCalledTimes(200);
    expect(activities.length).toBe(200);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns an empty list and logs when a page fails', async () => {
    spyOn(console, 'error');
    get.and.returnValues(
      Promise.resolve({ items: rows(1, 100), cursor: 'c1', has_more: true }),
      Promise.reject(new Error('offline')),
    );

    expect(await service.getActivities(1)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
