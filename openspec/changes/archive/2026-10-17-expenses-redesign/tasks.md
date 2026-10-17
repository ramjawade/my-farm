## 1. Form page

- [x] 1.1 `ExpenseFormComponent`: fields, required Activity (new), Category and Amount, errors after the first save attempt, amount from quantity and rate, unit suggestions
- [x] 1.2 Add mode: choose the activity (preselected from `activityId`), save with `addExpense`, return to the activity page or the list
- [x] 1.3 Edit mode: fill from the saved expense, activity disabled, save with `updateExpense`, return to the activity page
- [x] 1.4 Refresh the shared activity and expense data after a save; keep the form and show the error toast on failure
- [x] 1.5 Routes (`activities/expenses/new`, `activities/:activityId/expenses/:expenseId/edit`) with titles; page spacing and layout as on Home and Lands
- [x] 1.6 Specs for the form (validation, calculation, add, edit, cancel, failed save)

## 2. Entry points

- [x] 2.1 Activity page: "+ Add expense" links to the form; remove the expense dialog and the old `AddExpenseComponent`
- [x] 2.2 Expense rows: an Edit button beside Delete
- [x] 2.3 All activities: a "+ Expense" button beside "+ Log" on desktop
- [x] 2.4 Update the detail, expense list and list specs

## 3. Strings and wrap up

- [x] 3.1 mr, hi and en strings; keep the translation check green
- [x] 3.2 Update the Playwright golden path to add the expense through the page
- [x] 3.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [x] 3.4 Open the PR naming `expenses-redesign`
- [x] 3.5 After the PR merges, archive this change and tick task 3.6 in `prototype-adoption-roadmap/tasks.md`
