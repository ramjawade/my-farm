## Why

Adding an expense today opens a small dialog on the activity page, and there is no way to change an expense once it is saved: a wrong amount means deleting it and typing it again. The prototype gives expenses their own form page, the same one for adding and editing, with the activity chosen on the form, and an Edit action on every expense.

## What Changes

- **Add expense page** ("Add expense", "Record what an activity cost."): a form card with a Cancel button in the header and these fields:
  - Activity (required): a select of the farmer's activities, written as type, date and field. Preselected when opened from an activity.
  - Category (required, starts empty with "Select a category").
  - Item or service name; Vendor or labourer.
  - Quantity with its unit side by side (the unit offers hours, days, bags, litres and kg, and accepts any text); Rate (₹).
  - Amount (₹, required, above zero): worked out from quantity and rate while those are filled, and editable.
  - Remarks or notes.
  - Buttons: "Add expense" and Cancel. Errors show under a field after the first save attempt: "Select the activity this expense belongs to.", "Select a category.", "Enter an amount above zero."
- **Edit expense:** the same page titled "Edit expense" ("Update the category or amount of this expense."), filled with the saved values, with the activity shown but not changeable, and the button "Save changes".
- **From the activity page:** "+ Add expense" opens the page with that activity chosen, and the expense dialog is removed. Each expense row gets an Edit button beside Delete. Saving or cancelling returns to the activity page.
- **From All activities:** a "+ Expense" button beside "+ Log" on desktop opens the page with no activity chosen. Saving or cancelling returns to the list.
- Out of scope: the expenses list styling beyond the Edit action (done in `activity-types-and-statuses`), a standalone expenses report, new categories, backend changes.

## Capabilities

### New Capabilities
- `expense-form`: adding and editing an expense on its own page, and the entry points to it.

### Modified Capabilities
- none

## Impact

- Frontend: new `features/farm-activity/expense/` page and routes, `detail/` (dialog removed, Edit action), `list/` (+ Expense button), i18n keys for mr/hi/en, specs, Playwright golden path (it adds an expense through the dialog today).
- Backend: none; the API already has update and delete for expenses.
