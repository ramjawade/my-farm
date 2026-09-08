/**
 * Activity expenses — cost lines nested under an activity.
 *
 *   GET    /api/v1/activities/{aid}/expenses          -> CursorPage<ExpenseResponse>
 *   POST   /api/v1/activities/{aid}/expenses          -> ExpenseResponse   (201)
 *   PATCH  /api/v1/activities/{aid}/expenses/{id}     -> ExpenseResponse
 *   DELETE /api/v1/activities/{aid}/expenses/{id}     -> 204
 *
 * The owning `activity_id` is always taken from the URL path; the create
 * body doesn't carry it. `expense_category_id` is a reference-table FK.
 * Numeric fields are `Decimal` on the backend, serialised as JSON numbers.
 * Hand-written, frontend-owned (issue #49).
 */

import { AuditFields } from './common.contract';

export interface ExpenseResponse extends AuditFields {
  id: string;
  activity_id: string;
  expense_category_id: string;
  item_id: string | null;
  resource_id: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  remarks: string | null;
}

/** `ActivityExpenseCreate` — no `activity_id` (it's in the path). */
export interface ExpenseCreateRequest {
  expense_category_id: string;
  item_id?: string | null;
  resource_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  amount?: number | null;
  remarks?: string | null;
}

export interface ExpenseUpdateRequest {
  expense_category_id?: string;
  item_id?: string | null;
  resource_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  amount?: number | null;
  remarks?: string | null;
}
