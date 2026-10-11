## Context

`AddExpenseComponent` is a reactive form shown in a modal on the activity page (`detail/add-expense/`). It already loads categories from reference data and works out the amount from quantity and rate. `ActivityExpensesService` already has `addExpense`, `updateExpense` and `deleteExpense`; the update call is unused. `ActivityService.activities()` holds all the farmer's activities and its expenses signal feeds the tiles and totals. `ExpenseListComponent` (restyled in `activity-types-and-statuses`) shows an expense's rows with Delete.

## Goals / Non-Goals

**Goals:** a routed Add/Edit expense page matching the prototype, with entry points from the activity page and the All activities screen.

**Non-Goals:** a standalone expenses report, new categories, backend changes.

## Decisions

1. **Routed page, not a dialog.** A new `ExpenseFormComponent` under `features/farm-activity/expense/`, lazy-loaded at `activities/expenses/new` (query `activityId`, optional `from`) and `activities/:activityId/expenses/:expenseId/edit`. Both sit before `activities/:id` where needed so they do not clash. Both inherit the `authGuard` and the `activities` section parent.
2. **Reuse the form logic.** The old component's form group, category loading and amount calculation move into the new page and the old dialog component is deleted, so there is one form. The calculation stays a `valueChanges` subscription that skips the write when the amount already matches.
3. **Validation.** Activity (new only), Category and Amount (greater than zero) are required. Errors show after the first save attempt (a `tried` signal), with the prototype's wording; the Category control starts `null` with a placeholder option instead of defaulting to the first category.
4. **Activity select.** Options come from `ActivityService.activities()`, sorted newest first, each labelled "type · date · field" with the existing reference-name and farm lookups. When editing, the activity is a disabled control showing the expense's activity.
5. **Saving.** New expenses call `addExpense(activityId, ...)`; edits call `updateExpense(activityId, expenseId, ...)`. After a save the shared `ActivityService` expense list is refreshed through its existing sync (`syncExpensesForActivity`) so Home, the log tiles and per-activity totals update. A failure keeps the form and shows the existing error toast.
6. **Where to return.** `from=list` returns to `/activities/list`; otherwise to the activity's page. Cancel does the same.
7. **Activity page.** "+ Add expense" and the mobile add button become links to the new page with `activityId`. `ExpenseListComponent` gets an Edit button per row that links to the edit page; the expense dialog and its markup are removed from the detail page.
8. **All activities.** A "+ Expense" button beside "+ Log" (desktop only, as in the prototype) links to the form with `from=list`.
9. **Layout.** Page padding and card spacing follow Home and Lands; the form card is at most 760px wide; the fields sit in a two-column grid from `md` and one column on a phone; quantity and unit share a row.
10. **Translation.** New keys in mr, hi and en; most labels reuse the existing `addExpense.*` keys.

## Risks / Trade-offs

- The Playwright golden path adds an expense through the dialog today; it must be rewritten for the page.
- Without a default category the farmer must pick one; this matches the prototype and avoids silently saving the wrong category.
- Existing `addExpense.*` keys that become unused stay until a cleanup change.

## Migration Plan

Frontend only; no data changes.

## Open Questions

- None.
