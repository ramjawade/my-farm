import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ComponentRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ActivitiesSummaryComponent } from './activities-summary.component';
import { CropActivity } from '../../crop-timeline/crop-timeline.models';

describe('ActivitiesSummaryComponent', () => {
  let component: ActivitiesSummaryComponent;
  let fixture: ComponentFixture<ActivitiesSummaryComponent>;
  let componentRef: ComponentRef<ActivitiesSummaryComponent>;

  const base = { attachments: [], metadata: {}, createdAt: 1, updatedAt: 1 };
  const allActivities: CropActivity[] = [
    {
      ...base,
      id: 'act-s-1',
      cropId: 'c1',
      type: 'Irrigation',
      date: 1000,
      status: 'Completed',
      cost: 500,
      notes: '',
    },
    {
      ...base,
      id: 'act-s-2',
      cropId: 'c2',
      type: 'Fertilizer Application',
      date: 2000,
      status: 'Completed',
      cost: 1500,
      notes: '',
    },
    {
      ...base,
      id: 'act-s-3',
      cropId: 'c1',
      type: 'Weeding',
      date: 1500,
      status: 'Scheduled',
      cost: 300,
      notes: '',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivitiesSummaryComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivitiesSummaryComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create the component', () => {
    componentRef.setInput('activities', allActivities);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute metrics for all crops when given the full activity list', () => {
    componentRef.setInput('activities', allActivities);
    fixture.detectChanges();

    expect(component.allActivities().length).toBe(3);
    expect(component.totalExpense()).toBe(2300); // 500 + 1500 + 300
    expect(component.activitiesCount()).toBe(3);
    expect(component.inProgressCount()).toBe(1); // Weeding is Scheduled
    expect(component.completedCount()).toBe(2);
  });

  it('should compute metrics filtered by cropId when given a pre-filtered list', () => {
    const cropActivities = allActivities.filter((a) => a.cropId === 'c1');
    componentRef.setInput('activities', cropActivities);
    fixture.detectChanges();

    expect(component.allActivities().length).toBe(2);
    expect(component.totalExpense()).toBe(800); // 500 + 300
    expect(component.activitiesCount()).toBe(2);
    expect(component.inProgressCount()).toBe(1); // Weeding is Scheduled
    expect(component.completedCount()).toBe(1); // Irrigation is Completed
  });

  it('should compute correct chart data chronologically', () => {
    componentRef.setInput('activities', allActivities);
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
