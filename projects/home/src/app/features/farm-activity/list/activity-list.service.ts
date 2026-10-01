import { Injectable, inject } from '@angular/core';
import { ActivityPage, ActivityService } from '../../activity/activity.service';

const UPCOMING_STATUSES = ['Scheduled', 'Draft', 'In Progress'];

/** Rows fetched per page on the list view; "Load more" appends the next page. */
export const ACTIVITY_LIST_PAGE_SIZE = 20;

export interface ActivityListFilters {
  status: string;
  sort: string;
  cropId?: number;
  season?: string;
  landId?: number;
  activityTypeId?: number;
}

/**
 * Translates the list page's UI filter vocabulary (status/sort dropdown
 * values) into a targeted `/api/v1/activities` query via `ActivityService`,
 * rather than filtering the shared farm-wide signal cache client-side. Every
 * filter and sort is applied by the server so it covers the whole history, not
 * just the pages loaded so far.
 */
@Injectable({ providedIn: 'root' })
export class ActivityListService {
  private readonly activityService = inject(ActivityService);

  /** Fetches one page; pass the previous page's `cursor` to get the next. */
  loadPage(filters: ActivityListFilters, cursor?: string | null): Promise<ActivityPage> {
    return this.activityService.queryActivitiesPage({
      status: this.resolveStatus(filters.status),
      sort: this.resolveSort(filters.sort),
      cropId: filters.cropId,
      season: filters.season,
      landId: filters.landId,
      activityTypeId: filters.activityTypeId,
      limit: ACTIVITY_LIST_PAGE_SIZE,
      cursor: cursor ?? undefined,
    });
  }

  private resolveStatus(status: string): string[] | undefined {
    if (status === 'All') return undefined;
    if (status === 'Upcoming') return UPCOMING_STATUSES;
    return [status];
  }

  private resolveSort(sort: string): 'date_asc' | 'date_desc' | 'cost_desc' | undefined {
    if (sort === 'latest') return 'date_desc';
    if (sort === 'oldest') return 'date_asc';
    if (sort === 'cost') return 'cost_desc';
    return undefined;
  }
}
