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
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { FakeReferenceDataService } from '../../testing/fake-reference-data.service';

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
        { provide: ReferenceDataService, useClass: FakeReferenceDataService },
      ],
    });

    service = TestBed.inject(ReportService);
  });

  describe('sales and profit', () => {
    const SALE = 9; // Sale in FakeReferenceDataService
    const IRRIGATION = 2;
    const day = new Date('2026-07-10').getTime();

    async function crop(name: string, area: number, extra: Record<string, unknown> = {}) {
      return TestBed.inject(CropTimelineService).addCrop({
        fieldId: 1,
        name,
        cropCatalogId: 1,
        area,
        areaUnit: 'acres',
        season: 'Kharif',
        currentStage: 'Sowing',
        status: 'Active',
        ...extra,
      } as any);
    }

    async function sale(cropId: number, amount: number, status: 'Completed' | 'Scheduled') {
      return TestBed.inject(ActivityService).addActivity({
        activityTypeId: SALE,
        status,
        season: 'Kharif',
        date: day,
        cropId,
        sale: { quantity: 1, unit: 'kg', rate: amount, amount },
      });
    }

    async function spend(cropId: number | undefined, amount: number) {
      const activityService = TestBed.inject(ActivityService);
      const activity = await activityService.addActivity({
        activityTypeId: IRRIGATION,
        status: 'Completed',
        season: 'Kharif',
        date: day,
        cropId,
      });
      await activityService.addExpense({
        activityId: activity.id,
        expenseCategoryId: 3,
        amount,
      } as any);
    }

    it('totals completed sales, ignores planned ones, and works out profit per crop', async () => {
      const tomato = await crop('Tomato', 2);
      const cabbage = await crop('Cabbage', 1);
      await sale(tomato.id, 15000, 'Completed');
      await sale(tomato.id, 99999, 'Scheduled');
      await spend(tomato.id, 4000);
      await spend(cabbage.id, 1000);
      await spend(undefined, 500); // no crop, still part of the season's expenses

      const report = service.generateSeasonReport('Kharif', 2026);

      expect(report.totalSales).toBe(15000);
      expect(report.totalExpense).toBe(5500);
      expect(report.net).toBe(9500);
      expect(report.cropsSold).toBe(1);
      expect(report.hasData).toBeTrue();
      expect(report.crops.map((c) => c.cropName)).toEqual(['Tomato', 'Cabbage']);
      expect(report.crops[0]).toEqual(
        jasmine.objectContaining({
          sales: 15000,
          expenses: 4000,
          soldCount: 1,
          profitPerAcre: 5500,
        }),
      );
      expect(report.crops[1]).toEqual(
        jasmine.objectContaining({ sales: 0, expenses: 1000, soldCount: 0 }),
      );
    });

    it('has no per-acre figure for a crop without an area', async () => {
      const bare = await crop('Bare', 0);
      await sale(bare.id, 500, 'Completed');

      const row = service.generateSeasonReport('Kharif', 2026).crops[0];

      expect(row.sales).toBe(500);
      expect(row.profitPerAcre).toBeNull();
    });

    it('leaves out sales of other seasons and years', async () => {
      const tomato = await crop('Tomato', 1);
      await sale(tomato.id, 700, 'Completed');

      expect(service.generateSeasonReport('Rabi', 2026).totalSales).toBe(0);
      expect(service.generateSeasonReport('Kharif', 2025).totalSales).toBe(0);
      expect(service.generateSeasonReport('Kharif', 2025).hasData).toBeFalse();
    });

    it('lists one row per sowing of a crop name, newest first, unaffected by the season', async () => {
      const old = await crop('Tomato', 1, {
        sowingDate: new Date('2025-06-15').getTime(),
        status: 'Completed',
      });
      const current = await crop('Tomato', 2, { sowingDate: new Date('2026-06-15').getTime() });
      await crop('Onion', 1);
      await sale(old.id, 31500, 'Completed');
      await spend(old.id, 17200);

      expect(service.comparableCropNames()).toEqual(['Onion', 'Tomato']);
      const rows = service.compareRows('Tomato');

      expect(rows.map((r) => r.cropId)).toEqual([current.id, old.id]);
      expect(rows[0]).toEqual(
        jasmine.objectContaining({
          season: 'Kharif',
          year: 2026,
          inProgress: true,
          sold: false,
          profitPerAcre: 0,
        }),
      );
      expect(rows[1]).toEqual(
        jasmine.objectContaining({
          year: 2025,
          inProgress: false,
          sold: true,
          sales: 31500,
          expenses: 17200,
          profitPerAcre: 14300,
        }),
      );
    });

    it('writes the summary and profit by crop into the CSV and quotes crop names', async () => {
      const odd = await crop('Gram, local', 1);
      await sale(odd.id, 1200, 'Completed');
      await spend(odd.id, 200);

      const csv = service.reportToCSV(service.generateSeasonReport('Kharif', 2026));

      expect(csv).toContain('Total Sales: ₹1200.00');
      expect(csv).toContain('Net So Far: ₹1000.00');
      expect(csv).toContain('Crops Sold: 1 of 1');
      expect(csv).toContain('"Gram, local",1200.00,200.00,1000');
    });
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
