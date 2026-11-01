import { provideTranslateService } from '@ngx-translate/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { ReportsComponent } from './reports.component';
import { ReportService } from './report.service';
import { ActivityService } from '../activity/activity.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivitiesApiService } from '../../core/api/activities-api.service';
import { FakeActivitiesApiService } from '../../testing/fake-activities-api.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { FakeCropsApiService } from '../../testing/fake-crops-api.service';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { FakeReferenceDataService } from '../../testing/fake-reference-data.service';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';

const SALE = 9;
const IRRIGATION = 2;
const YEAR = new Date().getFullYear();
const JULY = new Date(YEAR, 6, 10).getTime(); // Kharif

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        ActivityService,
        CropTimelineService,
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
        { provide: CropsApiService, useClass: FakeCropsApiService },
        { provide: ReferenceDataService, useClass: FakeReferenceDataService },
      ],
    }).compileComponents();

    // Create the data services and run their start-up effect (it clears the lists while nobody
    // is signed in) before a test seeds, or that effect would wipe what the test just added.
    TestBed.inject(ReportService);
    TestBed.tick();
  });

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
    await TestBed.inject(ActivityService).addActivity({
      activityTypeId: SALE,
      status,
      season: 'Kharif',
      date: JULY,
      cropId,
      sale: { quantity: 1, unit: 'kg', rate: amount, amount },
    });
  }

  async function spend(cropId: number, amount: number) {
    const activityService = TestBed.inject(ActivityService);
    const activity = await activityService.addActivity({
      activityTypeId: IRRIGATION,
      status: 'Completed',
      season: 'Kharif',
      date: JULY,
      cropId,
    });
    await activityService.addExpense({
      activityId: activity.id,
      expenseCategoryId: 3,
      amount,
    } as any);
  }

  /** Create the page after seeding, so it starts with the data. */
  async function open(): Promise<void> {
    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    component.selectedSeason.set('Kharif');
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function chip(id: string): Promise<void> {
    const input = el.querySelector<HTMLInputElement>('#' + id)!;
    input.click();
    await settle();
  }

  async function seed(): Promise<{ tomatoId: number; cabbageId: number }> {
    const tomato = await crop('Tomato', 2);
    const cabbage = await crop('Cabbage', 1);
    await sale(tomato.id, 15000, 'Completed');
    await sale(tomato.id, 99999, 'Scheduled');
    await spend(tomato.id, 4000);
    await spend(cabbage.id, 1000);
    return { tomatoId: tomato.id, cabbageId: cabbage.id };
  }

  it('shows the empty message with the filter and Compare seasons, and no Export', async () => {
    await open();

    expect(el.querySelector('[data-testid="reports-empty"]')).not.toBeNull();
    expect(el.textContent).toContain('reports.emptyTitle');
    expect(el.querySelector('app-season-filter')).not.toBeNull();
    expect(el.querySelector('[data-testid="compare-seasons"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="export-top"]')).toBeNull();
    expect(el.querySelector('[data-testid="export-bottom"]')).toBeNull();
  });

  it('loads the season at once, with no Generate button', async () => {
    await seed();
    await open();

    expect(el.textContent).not.toContain('reports.generate');
    expect(el.querySelector('[data-testid="season-summary"]')).not.toBeNull();
    expect(el.textContent).toContain('Tomato');
    expect(el.textContent).toContain('Cabbage');
  });

  it('shows the summary figures, counting only the completed sale', async () => {
    await seed();
    await open();

    const summary = el.querySelector('[data-testid="season-summary"]')!.textContent!;
    expect(summary).toContain('₹15,000'); // total sales; the planned 99,999 is left out
    expect(summary).toContain('₹5,000'); // total expenses
    expect(el.querySelector('[data-testid="net"]')!.textContent).toContain('+₹10,000');
    expect(el.querySelector('[data-testid="net"]')!.classList).toContain('text-success');
  });

  it('shows a loss in the danger colour', async () => {
    const wheat = await crop('Wheat', 1);
    await spend(wheat.id, 800);
    await open();

    const net = el.querySelector('[data-testid="net"]')!;
    expect(net.textContent).toContain('−₹800');
    expect(net.classList).toContain('text-danger');
  });

  it('lists profit per acre for a crop with sales and "No sales yet" for one without', async () => {
    await seed();
    await open();

    const rows = Array.from(el.querySelectorAll('app-crop-profit-list li'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Tomato');
    expect(rows[0].textContent).toContain('+₹5,500'); // (15,000 - 4,000) / 2 acres
    expect(rows[1].textContent).toContain('Cabbage');
    expect(rows[1].textContent).toContain('reports.noSalesYet');
  });

  it('opens the crop when its row is selected', async () => {
    const { tomatoId } = await seed();
    await open();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    el.querySelector<HTMLButtonElement>('app-crop-profit-list li button')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/crops', tomatoId]);
  });

  it('shows the category and month breakdowns', async () => {
    await seed();
    await open();

    const bars = el.querySelectorAll('app-expense-bars');
    expect(bars.length).toBe(2);
    expect(bars[0].textContent).toContain('100'); // one category holds all of it
    expect(bars[1].querySelectorAll('.progress').length).toBe(1);
  });

  it('updates when the season or year chip changes', async () => {
    await seed();
    await open();
    expect(el.querySelector('[data-testid="season-summary"]')).not.toBeNull();

    await chip('reports-season-Rabi');
    expect(component.selectedSeason()).toBe('Rabi');
    expect(el.querySelector('[data-testid="reports-empty"]')).not.toBeNull();

    await chip('reports-season-Kharif');
    expect(el.querySelector('[data-testid="season-summary"]')).not.toBeNull();

    await chip('reports-year-' + (YEAR - 1));
    expect(component.selectedYear()).toBe(YEAR - 1);
    expect(el.querySelector('[data-testid="reports-empty"]')).not.toBeNull();
  });

  it('offers the current year and the two before it', async () => {
    await open();

    const years = Array.from(el.querySelectorAll('input[name="reports-year"]')).map((i) =>
      i.id.replace('reports-year-', ''),
    );
    expect(years).toEqual([String(YEAR), String(YEAR - 1), String(YEAR - 2)]);
  });

  it('marks the report phase once, the first time it shows data', async () => {
    await seed();
    const workflow = TestBed.inject(WorkflowStateService);
    const mark = spyOn(workflow, 'markPhaseComplete');
    await open();
    await chip('reports-season-Rabi');
    await chip('reports-season-Kharif');

    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith('report');
  });

  it('does not mark the report phase while the season is empty', async () => {
    const mark = spyOn(TestBed.inject(WorkflowStateService), 'markPhaseComplete');
    await open();

    expect(mark).not.toHaveBeenCalled();
  });

  it('puts Export CSV at the top on wide screens and at the bottom on phones', async () => {
    await seed();
    await open();
    const download = spyOn(TestBed.inject(ReportService), 'downloadCSV');

    const top = el.querySelector<HTMLButtonElement>('[data-testid="export-top"]')!;
    const bottom = el.querySelector<HTMLButtonElement>('[data-testid="export-bottom"]')!;
    expect(top.classList).toContain('d-none');
    expect(top.classList).toContain('d-md-inline-flex');
    expect(bottom.classList).toContain('d-md-none');

    top.click();
    bottom.click();
    expect(download).toHaveBeenCalledTimes(2);
    expect(download.calls.mostRecent().args[0].season).toBe('Kharif');
  });

  it('compares the sowings of a crop name and ignores the season filter', async () => {
    const old = await crop('Tomato', 1, {
      sowingDate: new Date(YEAR - 1, 5, 15).getTime(),
      status: 'Completed',
    });
    await crop('Tomato', 2, { sowingDate: new Date(YEAR, 5, 15).getTime() });
    await sale(old.id, 31500, 'Completed');
    await open();
    await chip('reports-season-Rabi'); // empty season, Compare still has rows

    const card = el.querySelector('[data-testid="compare-seasons"]')!;
    expect(card.textContent).toContain('reports.notFiltered');
    expect(card.querySelectorAll('input[name="reports-compare"]').length).toBe(1);
    expect(card.textContent).toContain(String(YEAR));
    expect(card.textContent).toContain(String(YEAR - 1));
    expect(card.textContent).toContain('reports.inProgress');
    expect(card.textContent).toContain('+₹31,500'); // 1 acre, no expenses
  });
});
