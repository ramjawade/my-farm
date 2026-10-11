## Why

Logging an activity and opening one are the farmer's most common actions, and both still use the old look. The Log activity form hides the 12 types in a combobox and lists only three of the five statuses. The activity page has buttons for Draft, In Progress and Completed only, so a scheduled or cancelled activity cannot be started, restored or cancelled. The prototype shows every type as an icon chip, sets the status from the date, and offers the right buttons for each status.

## What Changes

- **Log / Edit activity form:** the 12 activity types become radio chips with icons (Custom shows a "Custom activity name" field). All five statuses (Draft, Scheduled, In Progress, Completed, Cancelled) show as radio chips. The status follows the date until the farmer picks one: a future date is Scheduled, today or earlier is Completed. The same form edits an activity ("Edit activity", "Save changes"), with a Cancel button in the header.
- **Activity page:** the title carries a status badge (Draft grey, Scheduled blue, In Progress amber, Completed green, Cancelled red). The buttons depend on the status: Mark done (open activities), Start (Draft or Scheduled), Restore (Cancelled), Edit, Cancel activity (open activities) and Delete (always, after a confirmation). On a phone the buttons sit under the title.
- **Expenses on the activity page:** a card with the total, the number of expenses, a split bar by category and a row per expense with Edit and Delete, plus "+ Add expense".
- Notes show in their own card. On desktop expenses and notes sit side by side.
- Out of scope: the activity list and its filter bar (`activity-list-and-filters`), the add/edit expense form (`expenses-redesign`), image attachments, backend changes.

## Capabilities

### New Capabilities
- `activity-log-and-detail`: logging, editing and viewing one activity, its type and status, and the actions each status allows.

### Modified Capabilities
- none

## Impact

- Frontend: `features/farm-activity/create/` and `detail/` (templates, small status helper in `features/activity/`), i18n keys for mr/hi/en, specs, Playwright golden path if it uses the changed form controls.
- Backend: none; the five statuses already exist in the API.
