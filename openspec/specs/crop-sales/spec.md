# crop-sales Specification

## Purpose
A farmer records what they sold from a crop and sees, on the crop page, how much it earned and whether it made a profit.

## Requirements

### Requirement: Record a sale
A sale SHALL be recorded as an activity of type Sale on the Log activity form. "Record sale" on the crop page SHALL open that form with type Sale and the crop filled in. A Sale activity SHALL require a crop and SHALL show Quantity with a Unit, Rate per unit, Amount and Buyer. Date, Quantity, Unit, Rate and Amount SHALL be required when the status is Completed, with Quantity, Rate and Amount above zero; they SHALL be optional while the status is Draft, Scheduled or In Progress. Date SHALL start as today and the status SHALL follow the date as for any activity. Unit SHALL suggest crates, kg, quintal, bags and tonnes and accept any text. After saving from the crop page the farmer SHALL return to the crop page. The separate Record sale page SHALL no longer exist.

#### Scenario: Save a sale
- **WHEN** the farmer opens Record sale on a crop, enters 12 crates at 1250 and saves
- **THEN** a Completed Sale activity is saved for that crop with amount 15000 and the farmer returns to the crop page

#### Scenario: Missing fields
- **WHEN** the farmer saves a Completed Sale with nothing filled in
- **THEN** nothing is saved and the form shows "Enter a quantity above zero.", "Enter a rate above zero." and "Enter an amount above zero."

#### Scenario: Unit missing
- **WHEN** quantity is filled but Unit is empty on a Completed sale
- **THEN** the form shows "Enter a unit, such as crates or kg." and nothing is saved

#### Scenario: Planned sale
- **WHEN** the farmer logs a Sale dated in the future and leaves quantity, rate and amount empty
- **THEN** it is saved as Scheduled without figures

#### Scenario: Crop missing
- **WHEN** the farmer saves a Sale with no crop selected
- **THEN** nothing is saved and the form shows "Pick the crop that was sold."

#### Scenario: Failed save
- **WHEN** saving fails
- **THEN** the farmer stays on the form with what they typed and sees an error

### Requirement: Amount from quantity and rate
While Quantity and Rate both hold numbers on a Sale activity, Amount SHALL be set to their product. The farmer MUST be able to type a different amount.

#### Scenario: Calculated
- **WHEN** the farmer enters quantity 10 and rate 1100
- **THEN** the amount shows 11000

#### Scenario: Overridden
- **WHEN** the farmer then types 10500 as the amount
- **THEN** 10500 is saved

### Requirement: Sales card on the crop page
The crop page SHALL show a Sales card built from the crop's Sale activities, excluding Cancelled ones. With none it SHALL show "No sales yet" and a "Record sale" button. Otherwise it SHALL list one row per sale, newest first. A Completed sale row SHALL show the date, "quantity unit at rate", the buyer ("No buyer noted" when empty) and the amount. A sale that is not Completed SHALL show as "Planned sale" with its status badge and no amount. Each row SHALL open that activity's page. Total sales, Profit and Profit per acre SHALL appear when at least one sale is Completed and SHALL count only Completed sales. Profit SHALL be total sales minus the crop's total expenses. Profit per acre SHALL be profit divided by the crop's area, rounded to the rupee, and SHALL be empty when the crop has no area. A positive profit SHALL show in the success colour and a negative one in the danger colour.

#### Scenario: No sales
- **WHEN** a crop has no Sale activities
- **THEN** the card shows "No sales yet" and a "Record sale" button

#### Scenario: Profit
- **WHEN** a 1-acre crop with expenses of 18900 has Completed sales of 11000 and 15000
- **THEN** the card shows Total sales ₹26,000, Profit +₹7,100 in the success colour and Profit per acre +₹7,100

#### Scenario: Loss
- **WHEN** completed sales total less than the crop's expenses
- **THEN** Profit shows with a minus sign in the danger colour

#### Scenario: Planned sale not counted
- **WHEN** a crop has a Scheduled Sale and no Completed sale
- **THEN** the card lists the "Planned sale" row and shows no totals

#### Scenario: Open a sale
- **WHEN** the farmer selects a sale row
- **THEN** that Sale activity's page opens

### Requirement: Edit and delete a sale
A sale SHALL be edited and deleted from its activity page using the activity Edit and Delete actions, and the figures on the crop page SHALL update after either. Editing SHALL use the Log activity form filled with the saved values. Delete SHALL ask for confirmation, as for any activity.

#### Scenario: Correct an amount
- **WHEN** the farmer edits a sale and changes the amount from 11000 to 11500
- **THEN** the sale row shows ₹11,500 and Total sales includes it

#### Scenario: Delete
- **WHEN** the farmer deletes a sale activity and confirms
- **THEN** the row is gone from the Sales card and the totals drop by its amount

### Requirement: Sales belong to the farmer
A sale SHALL be readable and changeable only by the farmer who owns its activity. Asking for another farmer's sale activity SHALL return not found. The sale figures SHALL be accepted only on an activity of type Sale.

#### Scenario: Other farmer
- **WHEN** a farmer requests a Sale activity that belongs to someone else
- **THEN** the response is not found

#### Scenario: Figures on another type
- **WHEN** a request sets sale quantity, rate, amount or buyer on an activity that is not of type Sale
- **THEN** the request is refused

### Requirement: Existing sales are kept
Sales recorded before this change SHALL appear as Completed Sale activities with the same date, crop, quantity, unit, rate, amount, buyer and notes, so the Sales card and its totals are unchanged by the move.

#### Scenario: Migrated sale
- **WHEN** a crop had a sale of 12 crates at 1250 on 2 Oct 2026
- **THEN** after the change the Activity log shows a Completed Sale on that date for that crop and the Sales card shows the same row and amount
