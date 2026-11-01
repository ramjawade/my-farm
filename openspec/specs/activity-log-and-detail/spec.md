# activity-log-and-detail Specification

## Purpose
A farmer records, edits and opens one activity: what was done, when, on which crop and field, its status, and what it cost.

## Requirements

### Requirement: Activity type chips
The Log activity form SHALL show the 12 activity types (Sowing, Irrigation, Fertilizer Application, Spray Application, Weeding, Field Inspection, Labour Activity, Harvest, Sale, Weather Incident, Maintenance, Custom) as radio chips, each with an icon and its translated name. Exactly one type MUST be chosen to save. Choosing Custom SHALL reveal a required "Custom activity name" field.

#### Scenario: Pick a type
- **WHEN** the farmer selects the Irrigation chip
- **THEN** only that chip is selected and the form can be saved once its other required fields are filled

#### Scenario: Custom type
- **WHEN** the farmer selects Custom and leaves the name empty
- **THEN** saving is refused and the name field shows an error

### Requirement: Status follows the date
The form SHALL offer five statuses as radio chips: Draft, Scheduled, In Progress, Completed and Cancelled. A new activity SHALL start as Completed. While the farmer has not chosen a status, changing the date SHALL set it to Scheduled for a date after today and Completed otherwise. Once the farmer chooses a status, changing the date MUST NOT change it. When editing, the saved status SHALL be shown and kept.

#### Scenario: Future date
- **WHEN** the farmer sets a date after today without touching the status
- **THEN** Scheduled is selected

#### Scenario: Chosen status is kept
- **WHEN** the farmer selects In Progress and then changes the date to a future day
- **THEN** In Progress stays selected

### Requirement: Edit an activity
The same form SHALL edit an existing activity. It SHALL be titled "Edit activity", fill in the saved values, and the save button SHALL read "Save changes". Saving SHALL update the activity and return to its page. Cancel SHALL leave without saving.

#### Scenario: Edit and save
- **WHEN** the farmer opens Edit on an activity, changes the notes and saves
- **THEN** the activity page shows the new notes

### Requirement: Status badge and actions
The activity page SHALL show a status badge next to the title: Draft grey, Scheduled blue, In Progress amber, Completed green, Cancelled red. Its buttons SHALL depend on the status: "Mark done" for Draft, Scheduled and In Progress; "Start" for Draft and Scheduled; "Restore" for Cancelled; "Cancel activity" for Draft, Scheduled and In Progress; "Edit" and "Delete" for every status. Mark done SHALL set Completed, Start In Progress, Cancel activity Cancelled and Restore Scheduled.

#### Scenario: Scheduled activity
- **WHEN** the farmer opens a Scheduled activity
- **THEN** the buttons are Mark done, Start, Edit, Cancel activity and Delete

#### Scenario: Cancelled activity
- **WHEN** the farmer opens a Cancelled activity
- **THEN** the buttons are Restore, Edit and Delete

#### Scenario: Completed activity
- **WHEN** the farmer opens a Completed activity
- **THEN** the buttons are Edit and Delete

#### Scenario: Mark done
- **WHEN** the farmer selects Mark done on an In Progress activity
- **THEN** its badge changes to Completed

### Requirement: Delete needs confirmation
Delete SHALL ask for confirmation before removing the activity and its expenses, and on confirming SHALL return to the activity list.

#### Scenario: Declined
- **WHEN** the farmer selects Delete and declines the confirmation
- **THEN** the activity remains

### Requirement: Expenses on the activity page
The activity page SHALL show an Expenses card with the total, the number of expenses, a bar split by category, and a row per expense with its category, share, amount and a Delete action, plus a "+ Add expense" button. With none, it SHALL say no expenses are recorded. Notes SHALL show in a separate card when present.

#### Scenario: Split
- **WHEN** an activity has Labour ₹600 and Fuel ₹400
- **THEN** the card shows ₹1,000, "across 2 expenses", a two-part bar, and rows at 60% and 40%

#### Scenario: No expenses
- **WHEN** an activity has no expenses
- **THEN** the card says no expenses are recorded for this activity

### Requirement: Sale details on the Sale type
Choosing the Sale chip SHALL reveal a "Sale details" block with Quantity and Unit, Rate per unit, Amount and Buyer, and SHALL make the crop field required and label it "Crop sold". While the status is Completed the block SHALL say the details are required; for any other status it SHALL say they are optional while the sale is planned. Changing the status, or the date moving the status between Scheduled and Completed, SHALL update that text and which fields are marked required. Choosing another type SHALL hide the block, and saving MUST NOT keep sale figures on an activity that is not of type Sale. The rules for the figures are those of the `crop-sales` capability.

#### Scenario: Reveal
- **WHEN** the farmer selects the Sale chip
- **THEN** the Sale details block appears and the crop field is required

#### Scenario: Planned sale
- **WHEN** the farmer sets a future date on a Sale
- **THEN** Scheduled is selected and the block says the details are optional while the sale is planned

#### Scenario: Switch type
- **WHEN** the farmer fills in sale details and then selects Irrigation
- **THEN** the block is hidden and no sale figures are saved

### Requirement: Mark done needs the sale figures
Selecting "Mark done" on a Sale activity that has no quantity, unit, rate or amount SHALL open the Edit form with Completed selected instead of completing it, so a Completed sale never lacks its figures. "Mark done" on a Sale that already has all of them SHALL complete it as for any activity.

#### Scenario: Planned sale without figures
- **WHEN** the farmer selects Mark done on a Scheduled Sale with no figures
- **THEN** the Edit form opens with Completed selected and the figures required

#### Scenario: Planned sale with figures
- **WHEN** the farmer selects Mark done on a Scheduled Sale that has quantity, unit, rate and amount
- **THEN** its badge changes to Completed

### Requirement: Sale in the log and on the activity page
A Completed Sale row in the Activity log SHALL show "quantity unit at rate" and the buyer when present, and the amount with a plus sign in the success colour in place of the expense amount. The activity page of a Sale SHALL show a Sale card with the amount, "quantity unit at rate" and the buyer ("No buyer noted" when empty) next to the Expenses card; for a Sale that is not Completed it SHALL say the sale is planned and that the figures can be added by editing.

#### Scenario: Completed sale row
- **WHEN** a Completed Sale of 12 crates at 1250 to Nashik APMC is listed
- **THEN** its row shows "12 crates at ₹1,250 · Nashik APMC" and "+₹15,000"

#### Scenario: Planned sale page
- **WHEN** the farmer opens a Scheduled Sale with no figures
- **THEN** the Sale card says it is planned and that quantity, rate and amount can be added by editing
