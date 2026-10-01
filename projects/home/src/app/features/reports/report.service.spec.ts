import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ReportService } from './report.service';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivitiesApiService } from '../../core/api/activities-api.service';
import { FakeActivitiesApiService } from '../../testing/fake-activities-api.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { FakeCropsApiService } from '../../testing/fake-crops-api.service';

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        ReportService,
        ActivityService,
        CropTimelineService,
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
        { provide: CropsApiService, useClass: FakeCropsApiService },
      ],
    });

    service = TestBed.inject(ReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate empty report when no activities', () => {
    const report = service.generateSeasonReport('Kharif', 2026);
    expect(report.season).toBe('Kharif');
    expect(report.year).toBe(2026);
    expect(report.totalExpense).toBe(0);
    expect(report.byCategory.length).toBe(0);
  });

  it('should escape CSV quotes correctly', () => {
    const csv = service.reportToCSV(service.generateSeasonReport('Kharif', 2026));
    expect(csv).toContain('Kharif 2026');
    expect(csv).toContain('Total Expenses');
  });

  describe('which year and month an expense belongs to', () => {
    const date = (iso: string) => new Date(iso).getTime();

    async function record(iso: string | undefined, amount: number): Promise<void> {
      const activityService = TestBed.inject(ActivityService);
      const activity = await activityService.addActivity({
        activityTypeId: 1,
        status: 'Completed',
        season: 'Kharif',
        date: iso ? date(iso) : undefined,
      });
      await activityService.addExpense({
        activityId: activity.id,
        expenseCategoryId: 3,
        amount,
      } as any);
    }

    it('uses the activity date, not when the record was entered', async () => {
      await record('2025-06-15', 300); // entered today, but the work was in 2025

      expect(service.generateSeasonReport('Kharif', 2025).totalExpense).toBe(300);
      expect(service.generateSeasonReport('Kharif', new Date().getFullYear()).totalExpense).toBe(0);
    });

    it('falls back to the recorded date when an activity has no date', async () => {
      await record(undefined, 120);

      const thisYear = new Date().getFullYear();
      expect(service.generateSeasonReport('Kharif', thisYear).totalExpense).toBe(120);
    });

    it('groups expenses by the month of the activity', async () => {
      await record('2026-06-15', 100);
      await record('2026-06-20', 50);
      await record('2026-08-05', 400);

      const months = service.generateSeasonReport('Kharif', 2026).byMonth;

      expect(months.map((m) => m.total)).toEqual([150, 400]);
      expect(months[0].month).toContain('Jun');
      expect(months[1].month).toContain('Aug');
    });
  });
});
