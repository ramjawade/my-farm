# crop-sales Specification

## Purpose
A farmer records what they sold from a crop and sees, on the crop page, how much it earned and whether it made a profit.

## Requirements

### Requirement: Record a sale
The Record sale page SHALL show the crop (locked), Date sold, Quantity with a Unit, Rate per unit, Amount, Buyer and Notes, with Cancel in the header and "Save sale" and Cancel under the form. Date, Quantity, Unit, Rate and Amount SHALL be required, and Quantity, Rate and Amount SHALL be above zero. Date sold SHALL start as today. Unit SHALL suggest crates, kg, quintal, bags and tonnes and accept any text.

#### Scenario: Save a sale
- **WHEN** the farmer enters 12 crates at 1250 and selects "Save sale"
- **THEN** the sale is saved for that crop with amount 15000 and the farmer returns to the crop page

#### Scenario: Missing fields
- **WHEN** the farmer selects "Save sale" with nothing filled in
- **THEN** nothing is saved and the form shows "Enter a quantity above zero.", "Enter a rate above zero." and "Enter an amount above zero."

#### Scenario: Unit missing
- **WHEN** quantity is filled but Unit is empty
- **THEN** the form shows "Enter a unit, such as crates or kg." and nothing is saved

#### Scenario: Failed save
- **WHEN** saving fails
- **THEN** the farmer stays on the form with what they typed and sees an error

### Requirement: Amount from quantity and rate
While Quantity and Rate both hold numbers, Amount SHALL be set to their product. The farmer MUST be able to type a different amount.

#### Scenario: Calculated
- **WHEN** the farmer enters quantity 10 and rate 1100
- **THEN** the amount shows 11000

#### Scenario: Overridden
- **WHEN** the farmer then types 10500 as the amount
- **THEN** 10500 is saved

### Requirement: Sales card on the crop page
The crop page SHALL show a Sales card. With no sales it SHALL show "No sales yet" and a "Record sale" button. With sales it SHALL show Total sales, Profit and Profit per acre, then one row per sale, newest first, each with the date, "quantity unit at rate", the buyer ("No buyer noted" when empty) and the amount. Profit SHALL be total sales minus the crop's total expenses. Profit per acre SHALL be profit divided by the crop's area, rounded to the rupee, and SHALL be empty when the crop has no area. A positive profit SHALL show in the success colour and a negative one in the danger colour.

#### Scenario: No sales
- **WHEN** a crop has no sales
- **THEN** the card shows "No sales yet" and a "Record sale" button

#### Scenario: Profit
- **WHEN** a 1-acre crop with expenses of 18900 has sales of 11000 and 15000
- **THEN** the card shows Total sales ₹26,000, Profit +₹7,100 in the success colour and Profit per acre +₹7,100

#### Scenario: Loss
- **WHEN** sales total less than the crop's expenses
- **THEN** Profit shows with a minus sign in the danger colour

### Requirement: Edit and delete a sale
Each sale row SHALL offer Edit and Delete. Edit SHALL open the sale form filled with the saved values and the button "Save changes". Delete SHALL ask for confirmation before removing the sale. The figures on the crop page SHALL update after either.

#### Scenario: Correct an amount
- **WHEN** the farmer edits a sale and changes the amount from 11000 to 11500
- **THEN** the row shows ₹11,500 and Total sales includes it

#### Scenario: Delete
- **WHEN** the farmer deletes a sale and confirms
- **THEN** the row is gone and the totals drop by its amount

### Requirement: Sales belong to the farmer
A sale SHALL be readable and changeable only by the farmer who owns its crop. Asking for another farmer's sale SHALL return not found.

#### Scenario: Other farmer
- **WHEN** a farmer requests a sale of a crop that belongs to someone else
- **THEN** the response is not found
