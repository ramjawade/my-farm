import { Injectable, inject } from '@angular/core';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity, ActivityExpense } from '../../activity/activity.models';

function dateStringToTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

function timestampToDateString(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Wire-format mapping shared by `ActivityDetailService` and
 * `ActivityExpensesService` — kept in one place so both services resolve
 * `activity_type_id`/`expense_category_id` the same way, via `ReferenceDataService`.
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

  async toBackend(activity: Partial<Activity>): Promise<Record<string, unknown>> {
    return {
      activity_type_id:
        activity.type !== undefined
          ? await this.referenceData.activityTypeIdForName(activity.type)
          : undefined,
      crop_id: activity.cropId,
      land_id: activity.fieldId,
      parent_activity_id: activity.parentActivityId,
      custom_activity_name: activity.customActivityName,
      date: timestampToDateString(activity.date),
      season: activity.season,
      status: activity.status,
      notes: activity.notes,
      activity_meta: activity.metadata,
    };
  }

  async expenseFromBackend(item: any): Promise<ActivityExpense> {
    return {
      id: item.id,
      activityId: item.activity_id,
      category: await this.referenceData.expenseCategoryNameForId(item.expense_category_id),
      itemId: item.item_id ?? undefined,
      resourceId: item.resource_id ?? undefined,
      quantity:
        item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : undefined,
      unit: item.unit ?? undefined,
      rate: item.rate !== null && item.rate !== undefined ? Number(item.rate) : undefined,
      amount: Number(item.amount ?? 0),
      remarks: item.remarks ?? undefined,
      createdAt: new Date(item.created_at).getTime(),
    };
  }

  async expenseToBackend(expense: Partial<ActivityExpense>): Promise<Record<string, unknown>> {
    return {
      expense_category_id:
        expense.category !== undefined
          ? await this.referenceData.expenseCategoryIdForName(expense.category)
          : undefined,
      item_id: expense.itemId,
      resource_id: expense.resourceId,
      quantity: expense.quantity,
      unit: expense.unit,
      rate: expense.rate,
      amount: expense.amount,
      remarks: expense.remarks,
    };
  }
}
