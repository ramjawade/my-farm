import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ACTIVITY_LIST_PAGE_SIZE, ActivityListService } from './activity-list.service';
import { ActivityService } from '../../activity/activity.service';

describe('ActivityListService', () => {
  let queryPage: jasmine.Spy;
  let service: ActivityListService;

  beforeEach(() => {
    queryPage = jasmine
      .createSpy('queryActivitiesPage')
      .and.resolveTo({ items: [], cursor: null, hasMore: false });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivityService, useValue: { queryActivitiesPage: queryPage } },
      ],
    });
    service = TestBed.inject(ActivityListService);
  });

  it('requests a page of 20 with no filters by default', async () => {
    await service.loadPage({ status: 'All', sort: 'latest' });

    expect(ACTIVITY_LIST_PAGE_SIZE).toBe(20);
    expect(queryPage).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ limit: 20, status: undefined, sort: 'date_desc' }),
    );
  });

  it('translates UI status and sort values', async () => {
    await service.loadPage({ status: 'Upcoming', sort: 'oldest' });
    await service.loadPage({ status: 'Completed', sort: 'cost' });

    expect(queryPage.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({
        status: ['Scheduled', 'Draft', 'In Progress'],
        sort: 'date_asc',
      }),
    );
    expect(queryPage.calls.argsFor(1)[0]).toEqual(
      jasmine.objectContaining({ status: ['Completed'], sort: 'cost_desc' }),
    );
  });

  it('passes crop, season, land, activity type and the cursor through', async () => {
    await service.loadPage(
      { status: 'All', sort: 'latest', cropId: 4, season: 'Rabi', landId: 9, activityTypeId: 2 },
      'next-cursor',
    );

    expect(queryPage).toHaveBeenCalledOnceWith({
      status: undefined,
      sort: 'date_desc',
      cropId: 4,
      season: 'Rabi',
      landId: 9,
      activityTypeId: 2,
      limit: 20,
      cursor: 'next-cursor',
    });
  });

  it('omits the cursor for the first page', async () => {
    await service.loadPage({ status: 'All', sort: 'latest' }, null);

    expect(queryPage.calls.argsFor(0)[0].cursor).toBeUndefined();
  });
});
