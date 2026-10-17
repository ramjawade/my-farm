# expense-form Specification

## Purpose
A farmer records what an activity cost, and corrects it later, on one form page.

## ADDED Requirements

### Requirement: Add expense form
The Add expense page SHALL show fields for Activity, Category, Item or service name, Vendor or labourer, Quantity with a Unit, Rate, Amount and Remarks, with a Cancel button in the header and "Add expense" and Cancel buttons under the form. Activity, Category and Amount SHALL be required. The Activity select SHALL list all the farmer's activities, each as type, date and field. The Category select SHALL start empty with the prompt "Select a category". The Unit field SHALL suggest hours, days, bags, litres and kg and accept any text.

#### Scenario: Save an expense
- **WHEN** the farmer chooses an activity and a category, enters 1200 as the amount and selects "Add expense"
- **THEN** the expense is saved against that activity and the farmer returns to where they came from

#### Scenario: Missing required fields
- **WHEN** the farmer selects "Add expense" with nothing filled in
- **THEN** nothing is saved and the form shows "Select the activity this expense belongs to.", "Select a category." and "Enter an amount above zero."

#### Scenario: Zero amount
- **WHEN** the farmer enters 0 as the amount
- **THEN** the amount error shows and nothing is saved

### Requirement: Amount from quantity and rate
While both Quantity and Rate hold numbers, Amount SHALL be set to their product. The farmer MUST be able to type over the amount.

#### Scenario: Calculated
- **WHEN** the farmer enters quantity 3 and rate 500
- **THEN** the amount shows 1500

### Requirement: Edit expense
Each expense on the activity page SHALL have an Edit button that opens the same form titled "Edit expense", filled with the saved values and with the Activity shown but not changeable. The button SHALL read "Save changes". Saving SHALL update the expense and return to the activity page, where the new values show.

#### Scenario: Correct an amount
- **WHEN** the farmer edits an expense, changes the amount from 1000 to 1200 and saves
- **THEN** the activity page shows ₹1,200 for that expense and its total includes it

#### Scenario: Activity locked
- **WHEN** the farmer opens an expense for editing
- **THEN** the Activity select is disabled

### Requirement: Entry points
"+ Add expense" on the activity page SHALL open the form with that activity chosen. On desktop the All activities screen SHALL have a "+ Expense" button that opens the form with no activity chosen. Cancel and a successful save SHALL return to the page the farmer came from.

#### Scenario: From an activity
- **WHEN** the farmer selects "+ Add expense" on an activity's page
- **THEN** the form opens with that activity selected

#### Scenario: Cancel
- **WHEN** the farmer opens the form from an activity and selects Cancel
- **THEN** the activity page opens again and nothing is saved

#### Scenario: Failed save
- **WHEN** saving fails
- **THEN** the farmer stays on the form with what they typed and sees an error
