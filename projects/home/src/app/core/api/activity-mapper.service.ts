import { Injectable } from '@angular/core';
import { Activity, ActivityExpense, ActivitySale } from '../../features/activity/activity.models';

function numberOrUndefined(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

/** The sale figures of a backend row, or undefined when it carries none. */
function saleFromBackend(item: any): ActivitySale | undefined {
  const sale: ActivitySale = {
    quantity: numberOrUndefined(item.sale_quantity),
    unit: item.sale_unit ?? undefined,
    rate: numberOrUndefined(item.sale_rate),
    amount: numberOrUndefined(item.sale_amount),
    buyer: item.sale_buyer ?? undefined,
  };
  return Object.values(sale).some((v) => v !== undefined) ? sale : undefined;
}

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
 * Canonical Activity/ActivityExpense wire-format mapping. Reference FKs
 * (`activity_type_id`, `expense_category_id`) map straight to ids on the
 * models; names resolve at render time. Pure functions, no lookups. Every activity/expense read or write in the app goes through this one
 * mapper (ActivitiesApiService's list load, ActivityService's targeted
 * dashboard queries, and ActivityDetailService/ActivityExpensesService's
 * per-activity detail queries) instead of each maintaining its own copy.
 */
@Injectable({ providedIn: 'root' })
export class ActivityMapperService {
  fromBackend(item: any): Activity {
    return {
      id: item.id,
      parentActivityId: item.parent_activity_id ?? undefined,
      date: dateStringToTimestamp(item.date),
      season: item.season ?? undefined,
      cropId: item.crop_id ?? undefined,
      fieldId: item.land_id ?? undefined,
      activityTypeId: item.activity_type_id,
      customActivityName: item.custom_activity_name ?? undefined,
      status: item.status,
      notes: item.notes ?? undefined,
      metadata: item.activity_meta ?? undefined,
      sale: saleFromBackend(item),
      createdAt: new Date(item.created_at).getTime(),
      updatedAt: new Date(item.updated_at).getTime(),
    };
  }

  toBackend(activity: Partial<Activity>): Record<string, unknown> {
    return {
      activity_type_id: activity.activityTypeId,
      crop_id: activity.cropId,
      land_id: activity.fieldId,
      parent_activity_id: activity.parentActivityId,
      custom_activity_name: activity.customActivityName,
      date: timestampToDateString(activity.date),
      season: activity.season,
      status: activity.status,
      notes: activity.notes,
      activity_meta: activity.metadata,
      // When a sale is present send every figure (null clears one); otherwise leave them alone.
      ...(activity.sale && {
        sale_quantity: activity.sale.quantity ?? null,
        sale_unit: activity.sale.unit ?? null,
        sale_rate: activity.sale.rate ?? null,
        sale_amount: activity.sale.amount ?? null,
        sale_buyer: activity.sale.buyer ?? null,
      }),
    };
  }

  expenseFromBackend(item: any): ActivityExpense {
    return {
      id: item.id,
      activityId: item.activity_id,
      expenseCategoryId: item.expense_category_id,
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

  expenseToBackend(expense: Partial<ActivityExpense>): Record<string, unknown> {
    return {
      expense_category_id: expense.expenseCategoryId,
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
