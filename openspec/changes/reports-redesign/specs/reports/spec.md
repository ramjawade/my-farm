## ADDED Requirements

### Requirement: Season and year filter
The Reports page SHALL show Season chips (Kharif, Rabi, Zaid) and Year chips (the current year and the two before it). It SHALL start on the season of today's date and the current year. Selecting a chip SHALL update the page at once, with no Generate button. A report covers the activities whose season and year match the selection.

#### Scenario: Default
- **WHEN** the farmer opens Reports in October 2026
- **THEN** Kharif and 2026 are selected and the report shows that season

#### Scenario: Change season
- **WHEN** the farmer selects Rabi
- **THEN** the sections update to Rabi without any other action

### Requirement: Season summary
The page SHALL show a Season summary for the selection with Total sales, Total expenses, Net so far and Crops sold. Total sales SHALL be the sum of the amounts of Completed Sale activities in the selection; planned, Draft, In Progress and Cancelled sales SHALL NOT count. Total expenses SHALL be the sum of the expenses of the selected activities. Net so far SHALL be Total sales minus Total expenses, in the success colour when positive and the danger colour when negative. Crops sold SHALL read "N of M", where M is the crops with activity in the selection and N those with at least one Completed sale. A hint SHALL say that Net so far counts crops with no sales yet and that only completed sales are counted.

#### Scenario: Totals
- **WHEN** a Kharif 2026 selection has Completed sales of 11000 and 15000 and expenses of 18900 on one crop
- **THEN** the summary shows Total sales ₹26,000, Total expenses ₹18,900, Net so far +₹7,100 and Crops sold 1 of 1

#### Scenario: Planned sale not counted
- **WHEN** the only sale in the selection is Scheduled
- **THEN** Total sales is ₹0 and Crops sold is 0 of the crops listed

### Requirement: Profit by crop
The page SHALL list each crop with activity in the selection, with its sales, its expenses and its profit per acre, ordered with crops that have sales first. Profit per acre SHALL be (sales minus expenses) divided by the crop's area in acres, rounded to the rupee, in the success or danger colour by sign. A crop with no Completed sale SHALL show "–" and "No sales yet". A crop with no area SHALL show "–" for profit per acre. Selecting a row SHALL open that crop's page.

#### Scenario: Crop with sales
- **WHEN** a 1-acre crop has sales of 26000 and expenses of 18900
- **THEN** its row shows "Sales ₹26,000 · Expenses ₹18,900" and +₹7,100 profit per acre

#### Scenario: Crop without sales
- **WHEN** a crop has expenses but no Completed sale
- **THEN** its row shows "No sales yet"

#### Scenario: Open a crop
- **WHEN** the farmer selects a crop row
- **THEN** that crop's page opens

### Requirement: Expense breakdowns
The page SHALL show Expenses by category, with each category's amount, its percentage of the total and a bar, and Expenses by month, with each month's amount and a bar, both for the selection and ordered largest category first and by calendar month. When the selection has no expenses each SHALL say so.

#### Scenario: By category
- **WHEN** the selection has fertilizer expenses of 12000 out of 30000
- **THEN** the Fertilizer row shows ₹12,000 and 40%

#### Scenario: No expenses
- **WHEN** the selection has no expenses
- **THEN** the breakdown cards say there are no expenses this season

### Requirement: Compare seasons
The page SHALL show a Compare seasons card, labelled as not filtered, with a chip per crop name the farmer has grown. Selecting a name SHALL list one row per crop of that name, newest first, with its season and year from the sowing date, its area, its Completed sales, its expenses and its profit per acre with a bar. A crop still in progress SHALL carry an "In progress" badge. A crop with no Completed sale SHALL show "No sales yet". The card SHALL NOT change with the filter.

#### Scenario: Two sowings
- **WHEN** the farmer has grown Tomato in Kharif 2025 and Kharif 2026
- **THEN** choosing Tomato lists both, the 2026 one first and marked In progress

#### Scenario: Filter ignored
- **WHEN** the farmer changes the season chips
- **THEN** the Compare seasons rows stay the same

### Requirement: Nothing recorded
When the selection has no activity, the page SHALL show "Nothing recorded for this season" in place of the summary and breakdowns, and SHALL still show the filter and Compare seasons.

#### Scenario: Empty season
- **WHEN** the farmer selects Zaid 2025 and nothing was recorded then
- **THEN** the empty message shows and the chips and Compare seasons remain

### Requirement: Export CSV
Export CSV SHALL download the selected season as one file with the season summary, profit by crop, expenses by category and expenses by month. It SHALL be at the top right on a wide screen and at the bottom of the page on a phone, and SHALL be available only when the selection has data.

#### Scenario: Export
- **WHEN** the farmer selects Export CSV for Kharif 2026
- **THEN** a file named for the season and year downloads with total sales, total expenses, net, each crop's profit, and the category and month totals
