/**
 * Shared shapes used across every MyFarm API contract module.
 *
 * These interfaces are **hand-written and owned by the frontend** (issue
 * #49) — field names are the backend's (snake_case), on purpose, so a
 * mapper reads as a 1:1 translation. Unlike the other `*.contract.ts` files
 * (generated from `projects/backend/openapi.json`, see #196), this one
 * stays hand-written on purpose: `CursorPage`/`ReferencePage` describe a
 * response envelope the list routers hand-build (`response_model=dict`),
 * which has no schema for openapi-typescript to read. Drift here is caught
 * by the Playwright golden-path E2E (#44) and staging, not build-time.
 */

/** ISO-8601 timestamp string, e.g. `2026-09-09T08:00:00Z`. */
export type IsoDateTime = string;

/** `YYYY-MM-DD` calendar date string (the backend stores these as plain text). */
export type IsoDate = string;

/**
 * The list envelope every paginated GET returns:
 * `{ items, cursor, has_more }`. Note this is **not** the backend's
 * internal `Page[T]` model (`{ items, next_cursor }`) — the list routers
 * hand-build this shape (`response_model=dict`), and this is what the wire
 * actually carries.
 */
export interface CursorPage<T> {
  items: T[];
  cursor: string | null;
  has_more: boolean;
}

/** Query params accepted by every cursor-paginated list endpoint. */
export interface CursorPageParams {
  cursor?: string;
  limit?: number;
}

/** RFC 9457 `application/problem+json` — the one error shape for every endpoint. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string | null;
}

/** Soft-delete / audit columns shared by every farmer-owned record. */
export interface AuditFields {
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
}
