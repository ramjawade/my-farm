# Tasks

Three PRs, one sub-issue each, merged into the parent epic branch in this order (see design.md
Migration Plan). Backend tasks: `ruff`, `mypy`, `pytest`; after any router/schema change run
`python scripts/export_openapi.py` (from `projects/backend/`) then `npm run generate:contracts`.

## 1. API pagination, filters and sorts (PR 1, backend, default still unlimited)

- [x] 1.1 Add a cursor codec (base64url JSON `{s,k,id}`) with encode/decode and 422 on malformed or wrong-sort cursors. Verify: unit tests for round-trip, tampering and sort mismatch.
- [x] 1.2 Rebuild `GET /activities` as one query path: `limit` (1–100), `cursor`, `status`, `crop_id`, new `season`, `land_id`, `activity_type_id`; return `{ items, cursor, has_more }`; remove the no-params fast path; default limit constant `None`. Verify: existing activity endpoint tests still pass unchanged.
- [x] 1.3 Implement sorts default, `date_asc`, `date_desc` (nulls last, id tie-break) and `cost_desc` (correlated expense-sum subquery) with the keyset predicates from design.md. Verify: a traversal test per sort over data with null dates, duplicate dates and equal costs asserts every row exactly once, in order.
- [x] 1.4 Paginate `GET /activities/expenses` (`limit`, `cursor`, `{ items, cursor, has_more }`, order `updated_at DESC, id DESC`, excluding soft-deleted expenses and deleted activities). Verify: tests for limit honoured, full traversal, deleted expense absent, cross-tenant isolation.
- [x] 1.5 Test mid-traversal changes (create/update while paging never repeats an already-returned row) and filter-across-pages (120 of 300 matching). Verify: new tests pass.
- [x] 1.6 Check query plans on the 150k-row seed: default and `date_desc` list use an index, `cost_desc` uses `idx_activity_expense_activity_id`. Verify: paste `EXPLAIN` summaries and timings in the PR.
- [x] 1.7 Regenerate `openapi.json` and frontend contracts. Verify: `git diff --exit-code` after regeneration in CI ("Verify ... up to date" steps green). Run `ruff`, `mypy`, `pytest`.

## 2. Client paging and list page (PR 2, frontend)

- [ ] 2.1 Add `fetchAllPages` to `ActivitiesApiService` (limit 100, follow cursor, stop on `has_more` false/absent, 200-page cap) and use it in `getActivities`/`getExpenses`. Verify: spec with a fake `HttpService` covering 3 pages, a response without `has_more`, and the page cap.
- [ ] 2.2 Confirm `ActivityService` generation/in-flight guards discard a load that a mutation interrupts mid-paging. Verify: spec that mutates between page 1 and page 2 and sees the stale result dropped.
- [ ] 2.3 Replace `ActivityListService.load` with `loadPage(filters, cursor?)` returning `{ items, cursor, hasMore }`, passing status, sort (`cost` → `cost_desc`), crop, season, `land_id`, `activity_type_id`, `limit=20`. Verify: service spec asserting the query string for each filter.
- [ ] 2.4 Update `ActivityListComponent`: page state signals, reset-on-filter-change with stale-response token, "Load more" with inline retry, remove client-only season/field/type filters and client cost sort, bind type/field dropdowns to ids. Verify: component spec for first page, append, end of list, failure keeps rows, filter change resets, stale response ignored.
- [ ] 2.5 Template and a11y: "Load more" `<button>` with `aria-busy`, polite live region for "N more loaded"/"all shown", focus stays on the button. Verify: component spec on the live region text and focus; manual keyboard pass.
- [ ] 2.6 i18n: change `showingCount` to the no-total wording and add `loadMore`, `loadingMore`, `allLoaded`, `loadMoreError` in `en`, `hi`, `mr`. Verify: no missing-key warnings; specs use the keys.
- [ ] 2.7 Static mockup under `design/paginate-activities-and-expenses/` linked from the parent issue. Verify: file opens standalone.
- [ ] 2.8 Measure against the 150k-row seed in a browser: DOM nodes on `/activities/list` ≈ constant (~20 cards) and per-request payloads ≤ 100 rows. Verify: numbers recorded in the PR. Run `npm run lint`, `npm run build`, `npm test`, Prettier check, and the Playwright golden path (grep `e2e/` for changed selectors/text first).

## 3. Default page cap (PR 3, backend; only after PR 2 is live)

- [ ] 3.1 Confirm the PR 2 frontend is deployed to GitHub Pages and loads all activities for a farmer with more than 100 rows. Verify: note the deployed commit and a manual check in the PR description.
- [ ] 3.2 Set the default page limit to 100 for `GET /activities` and `GET /activities/expenses`. Verify: tests for 250 rows with no params (100 + `has_more`) and 40 rows (all, `has_more` false).
- [ ] 3.3 Regenerate `openapi.json` and contracts; run `ruff`, `mypy`, `pytest`, `npm run lint`, `npm run build`, `npm test`. Verify: CI green; Playwright golden path passes.
