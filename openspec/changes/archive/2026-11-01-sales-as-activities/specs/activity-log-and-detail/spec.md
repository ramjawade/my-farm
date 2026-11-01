## ADDED Requirements

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
