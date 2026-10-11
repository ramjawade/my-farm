## Context

`CreateActivityComponent` (365 lines TS, 281 HTML) already creates and edits (query param `activityId`), holds a `type` combobox over reference data, a status radio group with Draft, In Progress and Completed, and links crops, fields and a parent activity. `ActivityDetailComponent` shows a header, a summary card with three status transitions, notes and an expense list with an add-expense child. `ActivityStatus` already includes Scheduled and Cancelled, and `activityTypeIcon` maps types to Bootstrap icons. `ActivityService` has `updateActivity` and `deleteActivity`.

## Goals / Non-Goals

**Goals:** match the prototype's Log/Edit form and activity page for types, statuses, actions and the expense split.

**Non-Goals:** the list and filters, the expense form, image attachments, new endpoints.

## Decisions

1. **Type chips replace the combobox.** Chips are built from the reference data types plus Custom, so ids stay the source of truth. Choosing Custom shows a name field; saving a custom name keeps the current behaviour of creating the type through the existing "new type" path. The prototype's icons come from `activityTypeIcon`; no new icon map.
2. **Status helper.** A pure `statusForDate(date, today)` in `features/activity/` returns Scheduled for a later day and Completed otherwise, and a pure `allowedActions(status)` returns the button set. Both are unit-tested and used by the form and the page, so the rules live in one place.
3. **"Touched" flag.** The form tracks whether the farmer chose a status (a plain signal set on the radio change). Date changes call `statusForDate` only while it is false. Editing starts as touched.
4. **Status badge tones** reuse the Bootstrap subtle badges (`text-bg-secondary`, `-info`, `-warning`, `-success`, `-danger`); a shared `activityStatusTone` sits beside the helper so the list can reuse it later.
5. **Actions** call `updateActivity` with the new status; Delete uses the existing confirm dialog and `deleteActivity`, then navigates to `/activities/list`. The old Revert to Draft and Reopen buttons are dropped, since Start, Restore and Edit cover those moves.
6. **Expense split.** The existing `ExpenseListComponent` takes over the split: it loads the expenses and draws the total, the bar and the rows with a Delete action; the existing expense list component is restyled for this rather than adding a new one. Editing an expense waits for `expenses-redesign`. Category colours use the existing expense category tokens or Bootstrap theme colours, with no colour literals.
7. **Layout.** Page padding and card spacing follow Lands and Crops. The title row wraps the badge; on a phone the buttons wrap under it, on desktop they sit right. Expenses and notes use a two-column grid from `md` up.
8. **Translation.** New keys in mr, hi and en; type and status names reuse the existing reference-name lookups.

## Risks / Trade-offs

- Dropping Revert to Draft and Reopen removes two moves; Edit still allows setting any status.
- The backend may reject a status the farmer could not pick before (Scheduled, Cancelled); the model already allows them, and a failed save shows the existing error toast.
- Custom types create reference data; behaviour is unchanged from today.

## Migration Plan

Frontend only; no data changes.

## Open Questions

- Should Mark done on a future-dated activity also set the date to today? Assumed no, as in the prototype.
