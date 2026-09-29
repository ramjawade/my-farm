## Context

`ReferenceDataService` already caches all reference endpoints (one promise per endpoint) and exposes `xNameForId` / `xIdForName`. `ReferenceNamePipe` resolves a name through the `<category>.<slug>` translation key. Today `CropMapperService` and `ActivityMapperService` (the single canonical activity/expense mapper after #194) call these lookups on every map. `cropType` is only read in the mapper and set in `add-crop`; `Activity.type` (~66 references across 18 files) and `ExpenseCategory` (~14 files) are used by filters, badges, forms, reports and the chat-bot.

## Goals / Non-Goals

**Goals:** ids in models, sync mappers, names only at render. **Non-goals:** see proposal.

## Decisions

1. **Ids in the models, names derived.** Replace the three string fields with numeric ids. Add sync accessors to `ReferenceDataService` (`cropName(id)`, `activityTypeName(id)`, `expenseCategoryName(id)`) that read the already-loaded maps and return an empty string until loaded. Alternative (keep both id and name on the model) rejected: two sources of truth that can drift, the exact problem being removed.
2. **Non-blocking preload after the session is issued.** `ReferenceDataService` starts its existing 5 parallel GETs (no new requests, just earlier) without login awaiting them, and exposes a shared `ready` promise. Reference-heavy pages await `ready` alongside their own data load, so the cost is the slower of the two, not the sum. Alternatives rejected: awaiting at login (adds latency to sign-in) and a lazy async pipe per cell (request-per-render risk; API-flood history #125-#131).
3. **Cache freshness without polling.** Farmer-created entries (`createCrop`, `createActivityType`) already write into the local maps after the POST and stay cached. An id missing from the cache (created on another device, or stale) triggers a refetch of only that endpoint, once, then a second lookup, throttled to at most once per 30s per endpoint. The cache also refreshes when the app resumes or on manual pull-to-refresh. No timers, no effects that fire requests.
4. **Name-based logic goes through a helper, not string literals on the model.** Places that branch on a type (`'Custom'`, `'Harvest'`, `'Sowing'`) use `isActivityType(id, 'Custom')` in `activity.constants.ts`, which compares the resolved seeded name. Alternatives rejected: hardcoded seeded ids (DB-assigned) and a backend `code` column (backend change, out of scope; can be its own issue later).
5. **Pipe for templates, sync accessor for TS.** Templates use `referenceName` (translated); TS that needs a label (CSV export, sorting, chips) uses the accessor plus `resolveReferenceName`.
6. **Farmer-created crop names** keep using `createCrop` (create-or-get) at the form layer, so the mapper stays a pure rename. The write moves out of `toBackend` into add-crop / chat entry.
7. **Stacked delivery** on the parent branch, one PR per entity, mappers made sync last.

## Risks / Trade-offs

- Sync lookups before preload finishes render an empty label -> reference-heavy pages await `ready` with their own data; anything else renders an empty label until it resolves.
- Miss-refetch could loop on a permanently unknown id -> once per endpoint per 30s, and the lookup returns an empty string after the retry rather than throwing.
- Reports group and sort by category name -> group by id, sort by resolved (translated) name; verify with report specs.
- Chat-bot resolves names -> ids server-side (#242) and the review popup edits names -> confirm it converts to ids at the boundary.
- Wide blast radius on activity type -> land in its own PR with specs updated per file.

## Migration Plan

Per PR: change model + consumers + specs together, run lint/build/test. No data or API migration. Rollback is a revert of the PR.

## Open Questions

None open. Resolved: preload is non-blocking with a shared `ready` promise and throttled refetch-on-miss (decisions 2-3); `isActivityType` compares seeded names (decision 4).
