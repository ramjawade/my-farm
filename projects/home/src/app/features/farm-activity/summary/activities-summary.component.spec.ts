import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ComponentRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ActivitiesSummaryComponent } from './activities-summary.component';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { Activity, ActivityExpense } from '../../activity/activity.models';
import { AuthService } from '../../../core/auth/auth.service';
import { IStorageService } from '../../../core/storage/storage.interface';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { flushPromises } from '../../../testing/flush-promises';

describe('ActivitiesSummaryComponent', () => {
  let component: ActivitiesSummaryComponent;
  let fixture: ComponentFixture<ActivitiesSummaryComponent>;
  let componentRef: ComponentRef<ActivitiesSummaryComponent>;

  const base = { createdAt: 1, updatedAt: 1 };
  const mockActivities: Activity[] = [
    { ...base, id: 'act-s-1', cropId: 'c1', type: 'Irrigation', date: 1000, status: 'Completed' },
    {
      ...base,
      id: 'act-s-2',
      cropId: 'c2',
      type: 'Fertilizer Application',
      date: 2000,
      status: 'Completed',
    },
    { ...base, id: 'act-s-3', cropId: 'c1', type: 'Weeding', date: 1500, status: 'Scheduled' },
  ];
  const mockExpenses: ActivityExpense[] = [
    { id: 'e1', activityId: 'act-s-1', category: 'Water', amount: 500, createdAt: 1 },
    { id: 'e2', activityId: 'act-s-2', category: 'Fertilizer', amount: 1500, createdAt: 1 },
    { id: 'e3', activityId: 'act-s-3', category: 'Labour', amount: 300, createdAt: 1 },
  ];

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('my_farm_f-test_activities', JSON.stringify(mockActivities));
    localStorage.setItem('my_farm_f-test_activity_expenses', JSON.stringify(mockExpenses));

    await TestBed.configureTestingModule({
      imports: [ActivitiesSummaryComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        CropTimelineService,
        AuthService,
        { provide: IStorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesSummaryComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    // Login mock user
    const authSvc = TestBed.inject(AuthService);
    authSvc.login({ id: 'f-test' } as any);
    TestBed.flushEffects();
    await flushPromises();

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute metrics for all crops when cropId is not set', () => {
    componentRef.setInput('cropId', undefined);
    fixture.detectChanges();

    expect(component.allActivities().length).toBe(3);
    expect(component.totalExpense()).toBe(2300); // 500 + 1500 + 300
    expect(component.activitiesCount()).toBe(3);
    expect(component.inProgressCount()).toBe(1); // Weeding is Scheduled
    expect(component.completedCount()).toBe(2);
  });

  it('should compute metrics filtered by cropId when set', () => {
    componentRef.setInput('cropId', 'c1');
    fixture.detectChanges();

    expect(component.allActivities().length).toBe(2);
    expect(component.totalExpense()).toBe(800); // 500 + 300
    expect(component.activitiesCount()).toBe(2);
    expect(component.inProgressCount()).toBe(1); // Weeding is Scheduled
    expect(component.completedCount()).toBe(1); // Irrigation is Completed
  });

  it('should compute correct chart data chronologically', () => {
    componentRef.setInput('cropId', undefined);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.length).toBe(2); // Completed ones only (Irrigation, Fertilizer)
    // Irrigation (date 1000) is first
    expect(chartData[0].id).toBe('act-s-1');
    expect(chartData[0].cumulativeCost).toBe(500);
    // Fertilizer (date 2000) is second
    expect(chartData[1].id).toBe('act-s-2');
    expect(chartData[1].cumulativeCost).toBe(2000); // 500 + 1500
  });
});
