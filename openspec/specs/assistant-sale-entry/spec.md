# assistant-sale-entry Specification

## Purpose
TBD - created by archiving change assistant-sale-entry. Update Purpose after archive.

## Requirements

### Requirement: Sale figures are read from the farmer's words
When the farmer's text describes a sale, the parse SHALL return the activity type Sale and whichever of quantity, unit, rate, total amount and buyer the farmer actually said, and null for every other figure. It SHALL NOT calculate a figure the farmer did not say, so "12 crates at 1250" returns quantity 12, unit crates and rate 1250 with no amount, and "12 crates for 15000" returns quantity 12, unit crates and amount 15000 with no rate. A figure that is not above zero SHALL be returned as null. The sale figures SHALL be null for any other activity type.

#### Scenario: Quantity and rate
- **WHEN** the farmer writes "sold 12 crates of tomato at 1250"
- **THEN** the parsed entry is a Sale with quantity 12, unit crates, rate 1250 and no amount

#### Scenario: Quantity and total
- **WHEN** the farmer writes "sold 12 crates of tomato for 15000"
- **THEN** the parsed entry is a Sale with quantity 12, unit crates, amount 15000 and no rate

#### Scenario: Nothing said
- **WHEN** the farmer writes "sold tomato today"
- **THEN** the parsed entry is a Sale with every figure null

#### Scenario: Other activity
- **WHEN** the farmer writes "irrigated north plot, paid 400 for diesel"
- **THEN** the parsed entry has no sale figures

### Requirement: The bot asks for missing sale details
A Sale entry SHALL NOT be offered for Review & Save until it has a crop, a quantity with a unit, and a rate or a total. While something is missing the bot SHALL ask for it, one question at a time, in this order: the crop, the quantity and unit, the rate or the total, then the date. A question for the crop SHALL offer the farmer's crops as chips. The farmer MAY answer a question by typing, and the answer SHALL be read together with what was said before. A date question SHALL come last and only when no date was said.

#### Scenario: Crop missing
- **WHEN** the farmer says they sold something without naming a crop
- **THEN** the bot asks which crop and shows the farmer's crops as chips

#### Scenario: Quantity missing
- **WHEN** the crop is known but no quantity was said
- **THEN** the bot asks how much was sold, for example "12 crates"

#### Scenario: Rate and total missing
- **WHEN** crop, quantity and unit are known but neither a rate nor a total was said
- **THEN** the bot asks for the rate per unit or the total

#### Scenario: Answered by typing
- **WHEN** the bot asks how much was sold and the farmer types "5 crates"
- **THEN** the next question is the rate or the total

#### Scenario: Complete
- **WHEN** the crop, quantity, unit and a rate or total are known
- **THEN** the bot summarises the sale and offers Review & Save

### Requirement: Unanswered sale questions lead to the form
After two rounds on the same sale question without a usable answer, the bot SHALL stop asking and offer the manual form, which SHALL open on Log activity with the type Sale and the crop, date and notes it already knows filled in.

#### Scenario: Gives up
- **WHEN** the farmer answers the quantity question twice without a quantity
- **THEN** the bot says it could not get that and offers "Open the form", which opens Log activity with Sale chosen

### Requirement: Sale details in Review & Save
When the entry's type is Sale, Review & Save SHALL show Sale details with Quantity and Unit, Rate per unit, Amount and Buyer, prefilled from the parse. The crop SHALL be required. Amount SHALL equal quantity times rate until the farmer types a different amount, and a total the farmer said SHALL be kept. Saving SHALL be refused, with the same messages as the activity form, when quantity, unit, rate or amount is missing or not above zero, when the crop is missing, or when the date is after today. Changing the type to another activity SHALL hide the block and drop the figures.

#### Scenario: Prefilled
- **WHEN** the entry is "12 crates of tomato at 1250"
- **THEN** the sheet shows quantity 12, unit crates, rate 1250 and amount 15000

#### Scenario: Total kept
- **WHEN** the entry is "12 crates for 15000"
- **THEN** the amount is 15000 and the rate is worked out as 1250

#### Scenario: Missing figure
- **WHEN** the farmer clears the quantity and selects Save
- **THEN** nothing is saved and the sheet shows "Enter a quantity above zero."

#### Scenario: Future date
- **WHEN** the date is after today
- **THEN** saving is refused and the sheet says to pick today or an earlier date

### Requirement: Saved as a Completed Sale
Saving a Sale from Review & Save SHALL create a Completed Sale activity for that crop with the figures, so it appears on the crop's Sales card and in the Activity log like any other sale. The entry's provenance SHALL record the sale figures the model proposed.

#### Scenario: Saved
- **WHEN** the farmer saves the Sale of 12 crates of tomato at 1250
- **THEN** a Completed Sale of ₹15,000 exists for that crop and the bot confirms it

#### Scenario: Other entries unchanged
- **WHEN** the entry is not a Sale
- **THEN** no sale question is asked, no Sale details are shown and saving works as before
