# activity-log-screen Specification

## Purpose
The All activities screen shows what was done in the field, what it cost, and lets the farmer narrow the list.

## Requirements

### Requirement: Key tiles
The screen SHALL show two tiles above the filters. Total expenses SHALL show the expenses logged in the current season with "this season". Activities SHALL show the number of all the farmer's activities with "N done · N planned", where done means Completed and planned means any status other than Completed or Cancelled.

#### Scenario: Numbers
- **WHEN** a farmer has 5 activities, 3 Completed, 1 Scheduled and 1 Cancelled, and ₹2,000 of expenses this season
- **THEN** the tiles show ₹2,000 and 5 with "3 done · 1 planned"

### Requirement: Collapsible filter bar
The filter bar SHALL have a Filters button that shows or hides the panel of Season, Crop, Field, Type, Status and Sort by selects. The panel SHALL start closed. When filters are on, the button SHALL show a badge with their number and the bar SHALL be highlighted. While the panel is closed the active filters SHALL show as chips in the same row, each with a button that removes that filter. The bar SHALL show "Showing N of M", where N is the rows listed and M all the farmer's activities, and a Clear button only when a filter is on, which removes every filter.

#### Scenario: Open and close
- **WHEN** the farmer selects Filters twice
- **THEN** the panel opens and then closes, and the Filters button reports its state to assistive technology

#### Scenario: Chips while closed
- **WHEN** the Season filter is Kharif and the panel is closed
- **THEN** a "Season: Kharif" chip shows in the bar, and the badge reads 1

#### Scenario: Remove one filter
- **WHEN** the farmer selects the x on the Kharif chip
- **THEN** the filter is removed and the list reloads without it

#### Scenario: Clear
- **WHEN** two filters are on and the farmer selects Clear
- **THEN** both are removed and Clear disappears

### Requirement: Activity rows
The list SHALL show one card of compact rows. Each row SHALL show a date chip, the activity name, a line with its field, crop and status, and at the end the status badge when the activity is not Completed or Cancelled, otherwise its total expense (a dash when none), then a chevron. A Cancelled activity's name SHALL be struck through. Selecting a row SHALL open the activity. Load more SHALL append the next page.

#### Scenario: Open row
- **WHEN** the farmer selects a row
- **THEN** that activity's page opens

#### Scenario: Planned row
- **WHEN** an activity is Scheduled
- **THEN** its row ends with the Scheduled badge, not an amount

### Requirement: Empty and no-match states
With no activities the screen SHALL say there is no activity yet and offer "Log activity". When filters leave nothing it SHALL say "No activities match these filters."

#### Scenario: Filters match nothing
- **WHEN** the filters match no activity
- **THEN** the list card shows "No activities match these filters."

### Requirement: Season expenses card
The screen SHALL show a card with the season's total expenses and a bar per expense category with its amount, widest first, beside the list on desktop and below it on a phone. With no expenses it SHALL say none are recorded.

#### Scenario: Categories
- **WHEN** this season has Fertilizer ₹3,000 and Labour ₹1,000
- **THEN** the card shows ₹4,000 and two bars, Fertilizer first and wider
