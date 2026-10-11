import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { Activity } from '../../activity/activity.models';
import { ActivityFilterBarComponent, FilterChip } from './activity-filter-bar.component';
import { ActivityRowComponent } from './activity-row.component';
import { ActivitySeasonExpensesComponent } from './activity-season-expenses.component';

function setup<T>(component: new () => T, inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
  });
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, instance: fixture.componentInstance };
}

const activity = (extra: Partial<Activity> = {}): Activity =>
  ({
    id: 1,
    activityTypeId: 2,
    status: 'Completed',
    date: new Date(2026, 9, 3).getTime(),
    ...extra,
  }) as Activity;

describe('ActivityRowComponent', () => {
  it('shows the date chip and the amount of a finished activity, and opens it', () => {
    const act = activity();
    const { el, instance } = setup(ActivityRowComponent, {
      activity: act,
      fieldName: 'North',
      total: 1500,
    });
    const opened: Activity[] = [];
    instance.open.subscribe((a) => opened.push(a));

    expect(el.textContent).toContain('03');
    expect(el.textContent).toContain('North');
    expect(el.textContent).toContain('₹1,500');
    expect(el.querySelector('.badge')).toBeNull();
    el.querySelector('button')!.click();
    expect(opened).toEqual([act]);
  });

  it('shows a dash when a finished activity cost nothing', () => {
    const { el } = setup(ActivityRowComponent, { activity: activity(), total: 0 });
    expect(el.querySelector('strong.flex-shrink-0')?.textContent?.trim()).toBe('–');
  });

  it('shows the status badge for an open activity', () => {
    const { el } = setup(ActivityRowComponent, {
      activity: activity({ status: 'Scheduled' }),
      total: 900,
    });
    expect(el.querySelector('.badge')?.classList).toContain('text-bg-info');
    expect(el.textContent).not.toContain('₹900');
  });

  it('strikes through a cancelled activity', () => {
    const { el } = setup(ActivityRowComponent, { activity: activity({ status: 'Cancelled' }) });
    expect(el.querySelector('strong.d-block')?.classList).toContain('text-decoration-line-through');
  });
});

describe('ActivityFilterBarComponent', () => {
  const chips: FilterChip[] = [
    { key: 'season', label: 'Season', value: 'Kharif' },
    { key: 'status', label: 'Status', value: 'Completed' },
  ];

  it('starts closed, with a count badge and chips in the same row', () => {
    const { el } = setup(ActivityFilterBarComponent, { chips, shown: 3, total: 9 });
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls]')!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.badge')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('#activity-filter-panel')).toBeNull();
    expect(el.textContent).toContain('Kharif');
    expect(el.textContent).toContain('Completed');
  });

  it('opens the panel with six selects and hides the chips', () => {
    const { fixture, el } = setup(ActivityFilterBarComponent, { chips, shown: 3, total: 9 });
    el.querySelector<HTMLButtonElement>('button[aria-controls]')!.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('#activity-filter-panel select').length).toBe(6);
    expect(el.querySelector('button[aria-controls]')?.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.btn-close')).toBeNull();
  });

  it('leaves out the crop select when scoped to a crop', () => {
    const { fixture, el, instance } = setup(ActivityFilterBarComponent, { showCrop: false });
    instance.open.set(true);
    fixture.detectChanges();

    expect(el.querySelectorAll('#activity-filter-panel select').length).toBe(5);
  });

  it('emits a change when a select is picked', () => {
    const { fixture, el, instance } = setup(ActivityFilterBarComponent, {});
    const changes: { key: string; value: string }[] = [];
    instance.filterChange.subscribe((c) => changes.push(c));
    instance.open.set(true);
    fixture.detectChanges();

    const season = el.querySelector<HTMLSelectElement>('#af-season')!;
    season.value = 'Rabi';
    season.dispatchEvent(new Event('change'));

    expect(changes).toEqual([{ key: 'season', value: 'Rabi' }]);
  });

  it('removes one filter from its chip and clears them all', () => {
    const { el, instance } = setup(ActivityFilterBarComponent, { chips });
    const changes: { key: string; value: string }[] = [];
    let cleared = 0;
    instance.filterChange.subscribe((c) => changes.push(c));
    instance.cleared.subscribe(() => cleared++);

    el.querySelector<HTMLButtonElement>('.btn-close')!.click();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('activityLogScreen.clear'))!
      .click();

    expect(changes).toEqual([{ key: 'season', value: 'All' }]);
    expect(cleared).toBe(1);
  });

  it('hides Clear when no filter is on', () => {
    const { el } = setup(ActivityFilterBarComponent, { chips: [] });
    expect(el.textContent).not.toContain('activityLogScreen.clear');
  });
});

describe('ActivitySeasonExpensesComponent', () => {
  it('shows the total and a bar per category, widest first', () => {
    const { el } = setup(ActivitySeasonExpensesComponent, {
      rows: [
        { name: 'Fertilizer', amount: 3000 },
        { name: 'Labour', amount: 1000 },
      ],
    });
    const bars = Array.from(el.querySelectorAll<HTMLElement>('.progress-bar'));

    expect(el.textContent).toContain('₹4,000');
    expect(bars.map((b) => b.style.width)).toEqual(['100%', '33.3333%']);
  });

  it('says no expenses are recorded when there are none', () => {
    const { el } = setup(ActivitySeasonExpensesComponent, { rows: [] });
    expect(el.textContent).toContain('activityLogScreen.noSeasonExpenses');
  });
});
