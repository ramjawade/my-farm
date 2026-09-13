/**
 * Reference data — the seeded lookup tables that back the client's
 * free-text crop / activity / expense enums.
 *
 *   GET /api/v1/reference/crops               -> ReferencePage
 *   GET /api/v1/reference/expense-categories  -> ReferencePage
 *   GET /api/v1/reference/activity-types      -> ReferencePage
 *
 * All three share the `{ id, name }` item shape. `ReferenceDataService`
 * resolves names <-> ids in both directions. Hand-written, frontend-owned
 * (issue #49) — like `common.contract.ts`, kept out of the #196 generator
 * because these endpoints hand-build their `{ items, cursor, has_more }`
 * envelope rather than returning a schema-backed `response_model`.
 */

export interface ReferenceItem {
  id: number;
  name: string;
}

/**
 * Reference lists carry the same `{ items, cursor, has_more }` envelope as
 * the other paginated endpoints, but the item type is fixed, so this is
 * spelled out rather than `CursorPage<ReferenceItem>` to match how
 * `ReferenceDataService` already reads it.
 */
export interface ReferencePage {
  items: ReferenceItem[];
  cursor: string | null;
  has_more: boolean;
}
