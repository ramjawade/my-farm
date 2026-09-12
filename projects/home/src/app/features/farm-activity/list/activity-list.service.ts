import { Injectable, inject } from '@angular/core';
import { ActivityService } from '../../activity/activity.service';
import { Activity } from '../../activity/activity.models';

const UPCOMING_STATUSES = ['Scheduled', 'Draft', 'In Progress'];

export interface ActivityListFilters {
  status: string;
  sort: string;
  cropId?: number;
}

/**
 * Translates the list page's UI filter vocabulary (status/sort dropdown
 * values) into a targeted `/api/v1/activities` query via `ActivityService`,
 * rather than filtering the shared farm-wide signal cache client-side.
 */
@Injectable({ providedIn: 'root' })
export class ActivityListService {
  private readonly activityService = inject(ActivityService);

  async load(filters: ActivityListFilters): Promise<Activity[]> {
    return this.activityService.queryActivities({
      status: this.resolveStatus(filters.status),
      sort: this.resolveSort(filters.sort),
      cropId: filters.cropId,
    });
  }

  private resolveStatus(status: string): string[] | undefined {
    if (status === 'All') return undefined;
    if (status === 'Upcoming') return UPCOMING_STATUSES;
    return [status];
  }

  private resolveSort(sort: string): 'date_asc' | 'date_desc' | undefined {
    if (sort === 'latest') return 'date_desc';
    if (sort === 'oldest') return 'date_asc';
    return undefined; // 'cost' has no backend field — sorted client-side instead.
  }
}
