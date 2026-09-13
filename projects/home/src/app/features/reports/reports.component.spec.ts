import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ReportsComponent } from './reports.component';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { IStorageService } from '../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        ActivityService,
        CropTimelineService,
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('report() is null before Generate Report is clicked', () => {
    expect(component.report()).toBeNull();
  });

  it('generateReport() populates report() and renders the summary card', async () => {
    component.generateReport();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.report()).not.toBeNull();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Total Season Expenses');
  });

  it('renders real category/crop/month breakdowns for seeded data', async () => {
    const activityService = TestBed.inject(ActivityService);
    const cropService = TestBed.inject(CropTimelineService);

    const crop = await cropService.addCrop({
      fieldId: 1,
      name: 'Wheat',
      cropType: 'Wheat',
      area: 2,
      areaUnit: 'acres',
      season: 'Kharif',
      currentStage: 'Sowing',
    } as any);

    const activity = await activityService.addActivity({
      type: 'Sowing',
      status: 'Completed',
      season: 'Kharif',
      cropId: crop.id,
    });

    await activityService.addExpense({
      activityId: activity.id,
      category: 'Seeds',
      amount: 500,
    } as any);

    component.selectedSeason.set('Kharif');
    component.selectedYear.set(new Date(activity.createdAt).getFullYear());
    component.generateReport();
    await fixture.whenStable();
    fixture.detectChanges();

    const report = component.report();
    expect(report).not.toBeNull();
    expect(report?.totalExpense).toBe(500);
    expect(report?.byCrop.length).toBe(1);

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Wheat');
  });

  it('clicking the Generate Report button in the DOM populates the report', async () => {
    const compiled: HTMLElement = fixture.nativeElement;
    const button = Array.from(compiled.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Generate Report'),
    );
    expect(button).withContext('Generate Report button should exist').toBeTruthy();

    button!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.report()).not.toBeNull();
    expect(compiled.textContent).toContain('Total Season Expenses');
  });
});
