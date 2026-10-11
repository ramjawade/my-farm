## Context

`ActivityListComponent` (333 lines TS, 546 HTML) loads pages from the server through `ActivityListService`: status, sort, crop, season, field and type are all server filters, synced to the URL query params, with cursor paging and a load-more button. It also supports a crop-scoped route that hides the Crop filter. `ActivityService` already holds the farmer's full activity and expense lists as signals, which Home reads for its tiles. The prototype's `log()` builds the screen from two tiles, a filter bar (`lfbar`), compact rows and a season expenses card.

## Goals / Non-Goals

**Goals:** match the prototype's All activities screen on desktop and phone, keeping the existing server filtering, URL sync, paging and crop-scoped route.

**Non-Goals:** the "+ Expense" button, backend or API changes, the dashboard page, new filters.

## Decisions

1. **Keep the data flow.** The component's filter signals, URL sync, `reload()` and `loadMore()` stay as they are; this change is presentation plus a few computed values. That keeps the existing list specs valid.
2. **Pure helpers in `activity-log-summary.ts`:** `logTiles(activities, expenses, now)` returns the season spend and the done and planned counts, and `seasonByCategory(expenses, categoryName, now)` returns categories with amounts, widest first. Both are unit-tested on fixed dates. The season start comes from the `seasonStart` helper that Home already uses (moved to a shared place if importing across features would be awkward).
3. **"Showing N of M".** N is the loaded rows and M the full count from `ActivityService.activities()`. With a filter that the cache can answer the same way, M stays the unfiltered total, as in the prototype.
4. **Filter bar as a small presentational component** `ActivityFilterBarComponent`: inputs are the filter values and option lists, outputs are `changed` (name and value), `removed` and `cleared`, and it owns only the open/closed state. The page keeps the signals. The panel selects use `form-select`; the chips and badge use Bootstrap `badge` and utilities. The button sets `aria-expanded` and `aria-controls`.
5. **Rows as a presentational component** `ActivityRowComponent` (date chip, title, sub line, trailing badge or amount, chevron), a button that emits the activity to open. The row reuses `activityStatusTone` and `activityStatusKey` from the activity-types-and-statuses change. The amount comes from the existing per-activity total.
6. **Layout.** A single column on a phone: tiles, filter bar, list, season expenses. From `lg`, the list and the expenses card sit in two columns (`row` with `col-lg-7`/`col-lg-5`). Spacing and padding follow Lands, Crops and Home (12px gaps, 16px card padding).
7. **Removed:** the grid/list toggle, the old header buttons row, the large cards, the delete button on each card and its confirm dialog on this page. Delete remains on the activity page.
8. **Translation.** New keys in mr, hi and en; existing season, crop and status names reuse the reference-name lookups.

## Risks / Trade-offs

- Removing the list-page delete takes away a shortcut; it is one tap further on the activity page.
- "Showing N of M" counts the loaded rows, so it grows as Load more is used. This matches the prototype's meaning ("rows shown out of all").
- Old `activityList.*` keys that become unused stay until a cleanup change.

## Migration Plan

Frontend only; no data changes.

## Open Questions

- Should the "+ Expense" header button appear once `expenses-redesign` adds a standalone expense flow? Assumed it is added then.
