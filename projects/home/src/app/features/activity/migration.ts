import { Activity, ActivityExpense } from './activity.models';

const MIGRATION_FLAG = 'my_farm_activity_migration_done';

/**
 * Migrate old activity data from crop-timeline and farm-activity
 * to the unified ActivityService storage.
 *
 * Old keys:
 * - 'my_farm_crop_timeline' (CropTimelineService crops)
 * - 'my_farm_crop_timeline_activities' (crop-timeline's ActivityEntity records)
 * - 'my_farm_activities' (old farm-activity data) — renamed to 'my_farm_farm_activities_old'
 *
 * New keys:
 * - 'my_farm_activities' (unified Activity records)
 * - 'my_farm_activity_expenses' (ActivityExpense records)
 */
export function migrateActivityData(): void {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return; // Already migrated
  }

  const activities: Activity[] = [];
  const expenses: ActivityExpense[] = [];

  // Migrate old crop-timeline activities
  try {
    const oldCropTimeline = localStorage.getItem('my_farm_crop_timeline_activities');
    if (oldCropTimeline) {
      const oldActivities = JSON.parse(oldCropTimeline) as any[];
      oldActivities.forEach((oldAct) => {
        const activity: Activity = {
          id: oldAct.id || `activity_migrated_${Date.now()}`,
          parentActivityId: oldAct.parentActivityId,
          date: oldAct.date || Date.now(),
          season: oldAct.season,
          cropId: oldAct.cropId,
          fieldId: undefined,
          type: (oldAct.type as any) || 'Custom',
          customActivityName: undefined,
          status: convertActivityStatus(oldAct.status),
          notes: oldAct.notes,
          attachments: oldAct.attachments,
          metadata: oldAct.metadata,
          createdAt: oldAct.createdAt || Date.now(),
          updatedAt: oldAct.updatedAt || Date.now(),
        };
        activities.push(activity);

        // Migrate old cost as a single expense line if present
        if (oldAct.cost && oldAct.cost > 0) {
          const expense: ActivityExpense = {
            id: `expense_migrated_${oldAct.id}`,
            activityId: oldAct.id,
            category: 'Other',
            amount: oldAct.cost,
            createdAt: oldAct.createdAt || Date.now(),
          };
          expenses.push(expense);
        }
      });
    }
  } catch (e) {
    console.error('Failed to migrate old crop-timeline activities', e);
  }

  // Migrate old farm-activity activities and expenses
  try {
    const oldFarmActivities =
      localStorage.getItem('my_farm_farm_activities_old') ||
      localStorage.getItem('my_farm_activities_old');
    if (oldFarmActivities) {
      const oldActivities = JSON.parse(oldFarmActivities) as any[];
      oldActivities.forEach((oldAct) => {
        // Don't duplicate if already migrated from crop-timeline
        if (activities.find((a) => a.id === oldAct.id)) {
          return;
        }

        const activity: Activity = {
          id: oldAct.id || `activity_migrated_${Date.now()}`,
          parentActivityId: oldAct.parentActivityId,
          date: oldAct.date || Date.now(),
          season: oldAct.season,
          cropId: oldAct.cropId,
          fieldId: oldAct.fieldId,
          type: oldAct.activityId === 'Custom' ? 'Custom' : (oldAct.activityId as any) || 'Custom',
          customActivityName: oldAct.activityId === 'Custom' ? oldAct.activityId : undefined,
          status: convertActivityStatus(oldAct.status),
          notes: oldAct.notes,
          attachments: oldAct.attachments,
          metadata: undefined,
          createdAt: oldAct.createdAt || Date.now(),
          updatedAt: oldAct.updatedAt || Date.now(),
        };
        activities.push(activity);
      });

      // Migrate old farm-activity expenses
      const oldExpenses = localStorage.getItem('my_farm_activity_expenses_old');
      if (oldExpenses) {
        const parsedExpenses = JSON.parse(oldExpenses) as any[];
        parsedExpenses.forEach((oldExp) => {
          const expense: ActivityExpense = {
            id: oldExp.id,
            activityId: oldExp.activityId,
            category: oldExp.category || 'Other',
            itemId: oldExp.itemId,
            resourceId: oldExp.resourceId,
            quantity: oldExp.quantity,
            unit: oldExp.unit,
            rate: oldExp.rate,
            amount: oldExp.amount || 0,
            remarks: oldExp.remarks,
            createdAt: oldExp.createdAt || Date.now(),
          };
          expenses.push(expense);
        });
      }
    }
  } catch (e) {
    console.error('Failed to migrate old farm-activity data', e);
  }

  // Save migrated data to new keys
  if (activities.length > 0) {
    localStorage.setItem('my_farm_activities', JSON.stringify(activities));
  }
  if (expenses.length > 0) {
    localStorage.setItem('my_farm_activity_expenses', JSON.stringify(expenses));
  }

  // Mark migration as done
  localStorage.setItem(MIGRATION_FLAG, 'true');

  console.log(
    `✓ Migrated ${activities.length} activities and ${expenses.length} expenses to unified model`,
  );
}

/**
 * Convert old activity status enums to unified ActivityStatus
 */
function convertActivityStatus(oldStatus: string): any {
  const mapping: Record<string, any> = {
    Planned: 'Scheduled',
    Scheduled: 'Scheduled',
    'In Progress': 'In Progress',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    Draft: 'Draft',
  };
  return mapping[oldStatus] || 'Draft';
}
