import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ActivityDashboardComponent } from './activity-dashboard.component';
import { ActivityService } from '../../activity/activity.service';
import { Activity, ActivityKpiSummary } from '../../activity/activity.models';

describe('ActivityDashboardComponent', () => {
  let component: ActivityDashboardComponent;
  let fixture: ComponentFixture<ActivityDashboardComponent>;
  let getKpiSummarySpy: jasmine.Spy;
  let getUpcomingSpy: jasmine.Spy;
  let getRecentSpy: jasmine.Spy;

  const mockKpi: ActivityKpiSummary = {
    total: 3,
    completed: 1,
    inProgress: 2,
    totalExpense: 500,
  };

  const mockActivity: Activity = {
    id: 1,
    type: 'Irrigation',
    status: 'Scheduled',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    getKpiSummarySpy = jasmine.createSpy('getKpiSummary').and.resolveTo(mockKpi);
    getUpcomingSpy = jasmine.createSpy('getUpcomingActivities').and.resolveTo([mockActivity]);
    getRecentSpy = jasmine.createSpy('getRecentActivities').and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [ActivityDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({})) },
        },
        {
          provide: ActivityService,
          useValue: {
            getKpiSummary: getKpiSummarySpy,
            getUpcomingActivities: getUpcomingSpy,
            getRecentActivities: getRecentSpy,
            getTotalExpenseForActivity: () => 0,
            updateActivity: jasmine.createSpy('updateActivity'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('loads KPI/upcoming/recent on init, scoped by no cropId', async () => {
    expect(getKpiSummarySpy).toHaveBeenCalledWith(undefined);
    expect(getUpcomingSpy).toHaveBeenCalledWith(undefined, 5);
    expect(getRecentSpy).toHaveBeenCalledWith(undefined, 5);
    expect(component.kpi()).toEqual(mockKpi);
    expect(component.upcoming().length).toBe(1);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  it('shows an error state with retry when a call fails', async () => {
    getKpiSummarySpy.and.rejectWith(new Error('network down'));
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBe('Could not load your activities. Please try again.');

    getKpiSummarySpy.and.resolveTo(mockKpi);
    await component.load();

    expect(component.error()).toBeNull();
  });

  it('optimistically removes an activity from upcoming when marked completed', () => {
    component.upcoming.set([mockActivity]);
    component.onMarkActivityCompleted(mockActivity.id);

    expect(component.upcoming().length).toBe(0);
  });

  it('navigates to the create route with activityId when editing', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.onEditActivity(42);
    expect(router.navigate).toHaveBeenCalledWith(['/activities/create'], {
      queryParams: { activityId: 42 },
    });
  });
});
