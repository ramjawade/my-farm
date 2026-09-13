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
 */

/**
 * GENERATED — do not edit by hand.
 *
 * Run `npm run generate:contracts` to update, after regenerating
 * `projects/backend/openapi.json` (see projects/backend/scripts/export_openapi.py).
 * Source schemas: ActivityExpenseRead, ActivityExpenseCreate, ActivityExpenseUpdate.
 */

import type { components } from './generated/openapi-schema';

export type ExpenseResponse = components['schemas']['ActivityExpenseRead'];
export type ExpenseCreateRequest = components['schemas']['ActivityExpenseCreate'];
export type ExpenseUpdateRequest = components['schemas']['ActivityExpenseUpdate'];
