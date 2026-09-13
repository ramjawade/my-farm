import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivityDetailService } from './activity-detail.service';
import { ActivityMapperService } from '../../../core/api/activity-mapper.service';
import { EnvironmentService } from '../../../core/services/environment.service';
import { Activity } from '../../activity/activity.models';

describe('ActivityDetailService', () => {
  let service: ActivityDetailService;
  let httpMock: HttpTestingController;
  let mapper: jasmine.SpyObj<ActivityMapperService>;

  const apiUrl = 'https://api.test';
  const mappedActivity: Activity = {
    id: 5,
    type: 'Irrigation',
    status: 'Draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    mapper = jasmine.createSpyObj('ActivityMapperService', ['fromBackend']);
    mapper.fromBackend.and.resolveTo(mappedActivity);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivityMapperService, useValue: mapper },
        { provide: EnvironmentService, useValue: { getApiUrl: () => apiUrl } },
      ],
    });

    service = TestBed.inject(ActivityDetailService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches and maps a single activity', async () => {
    const promise = service.getActivity(5);
    const req = httpMock.expectOne(`${apiUrl}/activities/5`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 5 });

    expect(await promise).toEqual(mappedActivity);
  });

  it('fetches the per-activity KPI summary', async () => {
    const promise = service.getSummary(5);
    const req = httpMock.expectOne(`${apiUrl}/activities/5/summary`);
    req.flush({
      total_expense: 750,
      expense_count: 2,
      days_since_created: 3,
      status: 'pending' as any,
    });

    expect(await promise).toEqual({
      totalExpense: 750,
      expenseCount: 2,
      daysSinceCreated: 3,
      status: 'pending' as any,
    });
  });

  it('fetches the activity history, newest first', async () => {
    const promise = service.getHistory(5);
    const req = httpMock.expectOne(`${apiUrl}/activities/5/history`);
    req.flush({
      items: [
        {
          id: 2,
          activity_id: 5,
          event_type: 'status_changed',
          detail: null,
          created_at: '2026-09-08T02:00:00Z',
        },
        {
          id: 1,
          activity_id: 5,
          event_type: 'created',
          detail: null,
          created_at: '2026-09-08T00:00:00Z',
        },
      ],
    });

    const history = await promise;
    expect(history.length).toBe(2);
    expect(history[0].eventType).toBe('status_changed');
  });

  it('updates the activity status', async () => {
    const promise = service.updateStatus(5, 'completed' as any);
    const req = httpMock.expectOne(`${apiUrl}/activities/5`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'completed' });
    req.flush({ id: 5 });

    expect(await promise).toEqual(mappedActivity);
  });

  it('deletes the activity', async () => {
    const promise = service.deleteActivity(5);
    const req = httpMock.expectOne(`${apiUrl}/activities/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await promise;
  });
});
