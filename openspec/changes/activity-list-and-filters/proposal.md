## Why

The activity list is one of the screens a farmer opens daily, and it still has the old look: a header with a grid/list toggle, an always-open panel of six selects, and large cards with a delete button on each. The prototype's "All activities" shows the numbers first (total expenses, activity count), keeps filters out of the way until needed, and lists activities as compact rows that open the activity.

## What Changes

- **Header:** "All activities" with the line "Everything done in the field, with what it cost." On desktop a "+ Log" button opens the log form. The Grid/List toggle is removed; there is one list.
- **Two key tiles:** Total expenses ("this season") and Activities (the count, with "N done · N planned").
- **Filter bar:** a card with a "Filters" button that opens and closes the filter panel, a count badge showing how many filters are on, the chips of the active filters in the same row while the panel is closed (each chip has an x to remove it), "Showing N of M", and a Clear button when any filter is on. The panel holds Season, Crop, Field, Type, Status and Sort by, as selects in a grid. The bar is highlighted while a filter is on.
- **Activity list:** one card of compact rows: a date chip, the activity name (struck through when Cancelled), "field · crop · status" under it, then the status badge for activities still open or the amount for finished ones, and a chevron. A row opens the activity. The per-card delete button goes (Delete is on the activity page). Load more stays. With no activities there is an empty state with "Log activity"; with filters that match nothing it says "No activities match these filters."
- **Season expenses card:** the season's spend by category as bars, beside the list on desktop and below it on a phone.
- When the list is scoped to one crop (opened from a crop), the Crop filter stays hidden as today.
- Out of scope: the "+ Expense" header button (expenses are added from an activity until `expenses-redesign`), backend changes, the dashboard page.

## Capabilities

### New Capabilities
- `activity-log-screen`: the All activities screen: key tiles, filter bar, activity rows and season expenses.

### Modified Capabilities
- none

## Impact

- Frontend: `features/farm-activity/list/` (template, component, scss), a small pure helper for the tiles and category totals, i18n keys for mr/hi/en, specs, Playwright only if it reads the list.
- Backend: none; the filters and paging already exist.
