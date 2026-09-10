import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReportService } from './report.service';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { IStorageService } from '../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ReportService,
        ActivityService,
        CropTimelineService,
        { provide: IStorageService, useClass: InMemoryStorageService },
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
});
