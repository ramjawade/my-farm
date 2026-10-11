## 1. Helpers

- [ ] 1.1 Add `statusForDate`, `allowedActions` and `activityStatusTone` in `features/activity/` with specs on fixed dates

## 2. Log / Edit form

- [ ] 2.1 Replace the type combobox with icon radio chips (reference types plus Custom) and the Custom name field, with validation
- [ ] 2.2 Show all five statuses as chips; follow the date until the farmer chooses one; keep the saved status when editing
- [ ] 2.3 Titles and buttons for edit mode ("Edit activity", "Save changes", header Cancel); spacing as on Lands and Crops
- [ ] 2.4 Update `create-activity.component.spec.ts`

## 3. Activity page

- [ ] 3.1 Title with the status badge; header and phone layout
- [ ] 3.2 Status-dependent buttons (Mark done, Start, Restore, Edit, Cancel activity, Delete) wired to `updateActivity`, with the confirmation for Delete
- [ ] 3.3 `ActivityExpenseSplitComponent` (total, count, bar, rows with Edit and Delete, empty text, "+ Add expense") with specs
- [ ] 3.4 Notes card and the desktop two-column layout
- [ ] 3.5 Update `activity-detail.component.spec.ts`

## 4. Strings and wrap up

- [ ] 4.1 mr, hi and en strings; keep the translation check green
- [ ] 4.2 Update the Playwright golden path if it uses the changed form controls
- [ ] 4.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [ ] 4.4 Open the PR naming `activity-types-and-statuses`
- [ ] 4.5 After the PR merges, archive this change and tick task 3.4 in `prototype-adoption-roadmap/tasks.md`
