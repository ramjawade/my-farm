## 1. Helpers

- [x] 1.1 Add `statusForDate`, `allowedActions` and `activityStatusTone` in `features/activity/` with specs on fixed dates

## 2. Log / Edit form

- [x] 2.1 Replace the type combobox with icon radio chips (reference types plus Custom) and the Custom name field, with validation
- [x] 2.2 Show all five statuses as chips; follow the date until the farmer chooses one; keep the saved status when editing
- [x] 2.3 Titles and buttons for edit mode ("Edit activity", "Save changes", header Cancel); spacing as on Lands and Crops
- [x] 2.4 Update `create-activity.component.spec.ts`

## 3. Activity page

- [x] 3.1 Title with the status badge; header and phone layout
- [x] 3.2 Status-dependent buttons (Mark done, Start, Restore, Edit, Cancel activity, Delete) wired to `updateActivity`, with the confirmation for Delete
- [x] 3.3 Restyle `ExpenseListComponent` as the split card (total, count, bar, rows with Delete, empty text) with "+ Add expense" in the card header; Edit expense waits for `expenses-redesign`
- [x] 3.4 Notes card and the desktop two-column layout
- [x] 3.5 Update `activity-detail.component.spec.ts`

## 4. Strings and wrap up

- [x] 4.1 mr, hi and en strings; keep the translation check green
- [x] 4.2 Update the Playwright golden path if it uses the changed form controls
- [x] 4.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [ ] 4.4 Open the PR naming `activity-types-and-statuses`
- [ ] 4.5 After the PR merges, archive this change and tick task 3.4 in `prototype-adoption-roadmap/tasks.md`
