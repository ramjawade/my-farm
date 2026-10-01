import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { ActivityListComponent } from './activity-list.component';
import { ActivityListService } from './activity-list.service';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { FakeReferenceDataService } from '../../../testing/fake-reference-data.service';
import { Activity } from '../../activity/activity.models';
import { ActivityPage } from '../../activity/activity.service';

describe('ActivityListComponent', () => {
  let component: ActivityListComponent;
  let fixture: ComponentFixture<ActivityListComponent>;
  let loadSpy: jasmine.Spy;
  let queryParams: BehaviorSubject<Record<string, string>>;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const noFilters = {
    status: 'All',
    sort: 'latest',
    cropId: undefined,
    season: undefined,
    landId: undefined,
    activityTypeId: undefined,
  };

  function page(items: Activity[], cursor: string | null = null): ActivityPage {
    return { items, cursor, hasMore: cursor !== null };
  }

  function activityWithId(id: number): Activity {
    return { ...mockActivity, id };
  }

  const mockActivity: Activity = {
    id: 1,
    activityTypeId: 2,
    status: 'Scheduled',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [ActivityListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { queryParams, paramMap } },
        { provide: ActivityListService, useValue: { loadPage: loadSpy } },
        {
          provide: ActivityService,
          useValue: {
            activities: signal([]),
            getTotalExpenseForActivity: () => 0,
            deleteActivity: jasmine.createSpy('deleteActivity'),
          },
        },
        { provide: CropTimelineService, useValue: { crops: signal([]) } },
        { provide: FarmDrawService, useValue: { loadFarms: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: ReferenceDataService, useClass: FakeReferenceDataService },
      ],
    });

    fixture = TestBed.createComponent(ActivityListComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    loadSpy = jasmine.createSpy('loadPage').and.resolveTo(page([mockActivity]));
    queryParams = new BehaviorSubject<Record<string, string>>({});
    paramMap = new BehaviorSubject(convertToParamMap({}));
  });

  it('should create the list component', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('loads with no filters for the plain landing mode', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith(noFilters);
    expect(component.activities()).toEqual([mockActivity]);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  it('loads with Completed/latest for the "recent" landing mode', async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      status: 'Completed',
      sort: 'latest',
    });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ ...noFilters, status: 'Completed', sort: 'latest' });
  });

  it('loads with Upcoming/oldest for the "upcoming" landing mode', async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      status: 'Upcoming',
      sort: 'oldest',
    });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ ...noFilters, status: 'Upcoming', sort: 'oldest' });
  });

  it('scopes the load to a crop when the route supplies a cropId param', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '7' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ ...noFilters, cropId: 7 });
    expect(component.isCropScoped()).toBeTrue();
  });

  it('keeps Back/Record New Activity links scoped to the crop when crop-scoped', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '7' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.backLink()).toEqual(['/crops', 7]);
    expect(component.createLink()).toEqual(['/crops', 7, 'create']);
  });

  it('points Back/Record New Activity links at the farm-wide routes when not crop-scoped', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.backLink()).toEqual(['/activities']);
    expect(component.createLink()).toEqual(['/activities/create']);
  });

  it('shows an error state with retry when the load fails', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    loadSpy.and.rejectWith(new Error('network down'));
    await component.reload();

    expect(component.error()).toBe('activityList.loadError');

    loadSpy.and.resolveTo(page([mockActivity]));
    await component.reload();
    expect(component.error()).toBeNull();
  });

  it('optimistically removes an activity from the local list on delete', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.selectedActivityId.set(mockActivity.id);
    component.confirmDeleteActivity();

    expect(component.activities().length).toBe(0);
  });

  it('re-fetches when the manual crop filter changes', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    loadSpy.calls.reset();

    component.setCrop('3');
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ ...noFilters, cropId: 3 });
  });

  describe('paging', () => {
    const firstPage = Array.from({ length: 20 }, (_, i) => activityWithId(i + 1));
    const secondPage = Array.from({ length: 5 }, (_, i) => activityWithId(i + 21));

    async function openWithMore(): Promise<void> {
      loadSpy.and.resolveTo(page(firstPage, 'c1'));
      setup();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    const loadMoreButton = (): HTMLButtonElement | null =>
      (fixture.nativeElement as HTMLElement).querySelector('button[aria-busy]');
    const cards = (): number =>
      (fixture.nativeElement as HTMLElement).querySelectorAll('.card-interactive').length;

    it('renders only the first page and offers Load more', async () => {
      await openWithMore();

      expect(component.activities().length).toBe(20);
      expect(cards()).toBe(20);
      expect(loadMoreButton()?.textContent).toContain('activityList.loadMore');
    });

    it('appends the next page using the cursor and removes the button at the end', async () => {
      await openWithMore();
      loadSpy.calls.reset();
      loadSpy.and.resolveTo(page(secondPage));

      await component.loadMore();
      fixture.detectChanges();

      expect(loadSpy).toHaveBeenCalledOnceWith(noFilters, 'c1');
      expect(component.activities().length).toBe(25);
      expect(cards()).toBe(25);
      expect(component.hasMore()).toBeFalse();
      expect(loadMoreButton()).toBeNull();
      expect(component.liveMessage()).toBe('activityList.allLoaded');
    });

    it('announces how many rows were appended while more remain', async () => {
      await openWithMore();
      loadSpy.and.resolveTo(page(secondPage, 'c2'));

      await component.loadMore();

      expect(component.hasMore()).toBeTrue();
      expect(component.liveMessage()).toBe('activityList.moreLoaded');
    });

    it('keeps loaded rows and offers retry when Load more fails', async () => {
      await openWithMore();
      loadSpy.and.rejectWith(new Error('offline'));

      await component.loadMore();
      fixture.detectChanges();

      expect(component.loadMoreError()).toBeTrue();
      expect(component.activities().length).toBe(20);
      expect(loadMoreButton()?.textContent).toContain('activityList.loadMoreRetry');

      loadSpy.and.resolveTo(page(secondPage));
      await component.loadMore();
      expect(component.loadMoreError()).toBeFalse();
      expect(component.activities().length).toBe(25);
    });

    it('does not fetch another page while one is loading', async () => {
      await openWithMore();
      let release!: (p: ActivityPage) => void;
      loadSpy.calls.reset();
      loadSpy.and.returnValue(new Promise<ActivityPage>((resolve) => (release = resolve)));

      const first = component.loadMore();
      void component.loadMore();
      release(page(secondPage));
      await first;

      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate rows if a page repeats ids', async () => {
      await openWithMore();
      loadSpy.and.resolveTo(page([firstPage[19], activityWithId(99)]));

      await component.loadMore();

      expect(component.activities().map((a) => a.id)).toEqual([...firstPage.map((a) => a.id), 99]);
    });
  });

  describe('server-driven filters', () => {
    beforeEach(async () => {
      loadSpy.and.resolveTo(page([activityWithId(1), activityWithId(2)], 'c1'));
      setup();
      fixture.detectChanges();
      await fixture.whenStable();
      loadSpy.calls.reset();
    });

    it('sends the season to the server and resets to page one', async () => {
      loadSpy.and.resolveTo(page([activityWithId(3)]));

      component.setSeason('Kharif');
      await fixture.whenStable();

      expect(loadSpy).toHaveBeenCalledOnceWith({ ...noFilters, season: 'Kharif' });
      expect(component.activities().map((a) => a.id)).toEqual([3]);
      expect(component.cursor()).toBeNull();
      expect(component.hasMore()).toBeFalse();
    });

    it('sends the field as a land id', async () => {
      component.setField('12');
      await fixture.whenStable();

      expect(loadSpy).toHaveBeenCalledOnceWith({ ...noFilters, landId: 12 });
    });

    it('maps the selected activity type name to its reference id', async () => {
      component.setType('Irrigation'); // id 2 in the fake reference data
      await fixture.whenStable();

      expect(loadSpy).toHaveBeenCalledOnceWith({ ...noFilters, activityTypeId: 2 });
    });

    it('passes the cost sort to the server instead of sorting loaded rows', async () => {
      queryParams.next({ sort: 'cost' });
      await fixture.whenStable();

      expect(loadSpy).toHaveBeenCalledOnceWith({ ...noFilters, sort: 'cost' });
    });

    it('does not refetch when the query params did not change', async () => {
      queryParams.next({});
      await fixture.whenStable();

      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('ignores a slow response that a newer filter change superseded', async () => {
      let releaseSlow!: (p: ActivityPage) => void;
      loadSpy.and.returnValues(
        new Promise<ActivityPage>((resolve) => (releaseSlow = resolve)),
        Promise.resolve(page([activityWithId(7)])),
      );

      const slow = component.reload();
      component.setSeason('Rabi');
      await fixture.whenStable();
      releaseSlow(page([activityWithId(99)], 'stale'));
      await slow;

      expect(component.activities().map((a) => a.id)).toEqual([7]);
      expect(component.cursor()).toBeNull();
    });

    it('clearFilters refetches the unfiltered first page', async () => {
      component.setSeason('Rabi');
      await fixture.whenStable();
      loadSpy.calls.reset();

      component.clearFilters();
      await fixture.whenStable();

      expect(loadSpy).toHaveBeenCalledOnceWith(noFilters);
    });
  });
});
