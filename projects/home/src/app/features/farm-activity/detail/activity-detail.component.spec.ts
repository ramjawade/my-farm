import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ActivityDetailComponent } from './activity-detail.component';
import { ActivityDetailService } from './activity-detail.service';
import { ActivityExpensesService } from './activity-expenses.service';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';
import { Activity, ActivityDetailSummary, ActivityHistoryEntry } from '../../activity/activity.models';

describe('ActivityDetailComponent', () => {
  let component: ActivityDetailComponent;
  let fixture: ComponentFixture<ActivityDetailComponent>;
  let router: Router;
  let getActivitySpy: jasmine.Spy;
  let getSummarySpy: jasmine.Spy;
  let getHistorySpy: jasmine.Spy;
  let updateStatusSpy: jasmine.Spy;
  let deleteActivitySpy: jasmine.Spy;

  const mockActivity: Activity = {
    id: 5,
    type: 'Irrigation',
    status: 'Draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const mockSummary: ActivityDetailSummary = {
    totalExpense: 500,
    expenseCount: 1,
    daysSinceCreated: 2,
    status: 'Draft',
  };
  const mockHistory: ActivityHistoryEntry[] = [
    { id: 1, activityId: 5, eventType: 'created', createdAt: Date.now() },
  ];

  beforeEach(async () => {
    getActivitySpy = jasmine.createSpy('getActivity').and.resolveTo(mockActivity);
    getSummarySpy = jasmine.createSpy('getSummary').and.resolveTo(mockSummary);
    getHistorySpy = jasmine.createSpy('getHistory').and.resolveTo(mockHistory);
    updateStatusSpy = jasmine
      .createSpy('updateStatus')
      .and.resolveTo({ ...mockActivity, status: 'In Progress' });
    deleteActivitySpy = jasmine.createSpy('deleteActivity').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [ActivityDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        { provide: IStorageService, useClass: InMemoryStorageService },
        {
          provide: ActivityDetailService,
          useValue: {
            getActivity: getActivitySpy,
            getSummary: getSummarySpy,
            getHistory: getHistorySpy,
            updateStatus: updateStatusSpy,
            deleteActivity: deleteActivitySpy,
          },
        },
        {
          provide: ActivityExpensesService,
          useValue: { getExpenses: jasmine.createSpy('getExpenses').and.resolveTo([]) },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: '5' })) },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ActivityDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the activity, summary and history in parallel on init', () => {
    expect(getActivitySpy).toHaveBeenCalledWith(5);
    expect(getSummarySpy).toHaveBeenCalledWith(5);
    expect(getHistorySpy).toHaveBeenCalledWith(5);
    expect(component.activity()).toEqual(mockActivity);
    expect(component.summary()).toEqual(mockSummary);
    expect(component.history()).toEqual(mockHistory);
    expect(component.loading()).toBeFalse();
  });

  it('updates status and refreshes the summary', async () => {
    await component.updateStatus('In Progress' as any);

    expect(updateStatusSpy).toHaveBeenCalledWith(5, 'In Progress');
    expect(component.activity()?.status).toBe('In Progress');
    expect(getSummarySpy).toHaveBeenCalledTimes(2);
  });

  it('deletes the activity and navigates back to the list', async () => {
    spyOn(router, 'navigate');
    await component.confirmDeleteActivity();

    expect(deleteActivitySpy).toHaveBeenCalledWith(5);
    expect(router.navigate).toHaveBeenCalledWith(['/activities']);
  });

  it('shows an error state when loading fails', async () => {
    getActivitySpy.and.rejectWith(new Error('network down'));
    await (component as any).reload(5);

    expect(component.error()).toBe('Could not load this activity. Please try again.');
  });
});
