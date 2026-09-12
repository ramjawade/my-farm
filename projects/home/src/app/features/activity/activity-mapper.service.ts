import { Injectable, inject } from '@angular/core';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { Activity } from './activity.models';

function dateStringToTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

/**
 * Shared activity wire-format mapping — `activity_type_id` (backend FK)
 * versus `type` (frontend free text) needs `ReferenceDataService`, so this
 * can't be a plain pure function. Used by `ActivityService`'s targeted
 * dashboard queries (`getKpiSummary`/`getUpcomingActivities`/
 * `getRecentActivities`), which call `/api/v1/activities` directly rather
 * than going through the existing signal-cache load path.
 */
@Injectable({ providedIn: 'root' })
export class ActivityMapperService {
  private readonly referenceData = inject(ReferenceDataService);

  async fromBackend(item: any): Promise<Activity> {
    return {
      id: item.id,
      parentActivityId: item.parent_activity_id ?? undefined,
      date: dateStringToTimestamp(item.date),
      season: item.season ?? undefined,
      cropId: item.crop_id ?? undefined,
      fieldId: item.land_id ?? undefined,
      type: (await this.referenceData.activityTypeNameForId(
        item.activity_type_id,
      )) as Activity['type'],
      customActivityName: item.custom_activity_name ?? undefined,
      status: item.status,
      notes: item.notes ?? undefined,
      metadata: item.activity_meta ?? undefined,
      createdAt: new Date(item.created_at).getTime(),
      updatedAt: new Date(item.updated_at).getTime(),
    };
  }
}
