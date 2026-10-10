# lands-screen Specification

## Purpose
The Lands page shows the farmer's lands on a map and in a list, with what grows on each, and is where lands are drawn, saved, renamed and deleted.

## Requirements

### Requirement: Page header and layout
The Lands page SHALL show the number of lands and their total area in its header, a map card, and an "All lands" list. On a desktop viewport the list SHALL sit beside the map card; on a phone viewport it SHALL sit below it. A "Draw land" action SHALL be available.

#### Scenario: Header
- **WHEN** a farmer with 3 lands totalling 7.5 acres opens Lands
- **THEN** the header shows 3 lands and the 7.5 acre total

### Requirement: Land cards
Each land in "All lands" SHALL show an outline of its boundary, its name, the names of the crops growing on it or a "Fallow" badge when none, and its area. Selecting a card SHALL select that land on the map and show its detail.

#### Scenario: Land with crops
- **WHEN** a land has Onion and Tomato growing
- **THEN** its card shows "Onion, Tomato" and no Fallow badge

#### Scenario: Fallow land
- **WHEN** a land has no crops
- **THEN** its card shows the Fallow badge

#### Scenario: Select
- **WHEN** the farmer selects a card
- **THEN** the map centres on that land and its detail appears under the map

### Requirement: Selected land detail
For a land with no crops the detail SHALL show "Nothing growing on <name>", a short hint and an Add crop button, followed by a line with its area, water source and notes. For a land with crops it SHALL show Area, Crops, Total expenses, Cost per acre and, when set, Water source, a link to the crop's details and "+ Add another crop".

#### Scenario: Nothing growing
- **WHEN** the selected land has no crops
- **THEN** the empty state and Add crop button are shown, and Add crop opens the add-crop flow for that land

#### Scenario: Growing
- **WHEN** the selected land has crops with logged expenses
- **THEN** the detail shows the crop count, total expenses and cost per acre

### Requirement: Land actions
Each land card SHALL have an actions menu with Rename land and Delete land. Rename SHALL be inline and reject an empty name. Delete SHALL ask for confirmation before removing the land.

#### Scenario: Rename
- **WHEN** the farmer renames a land to "North field" and confirms
- **THEN** the card, the map label and the detail show "North field"

#### Scenario: Empty name
- **WHEN** the farmer confirms an empty name
- **THEN** an error is shown and the old name is kept

#### Scenario: Delete
- **WHEN** the farmer confirms deleting a land
- **THEN** the land is removed from the list and the map

### Requirement: Saving a drawn land
Drawing a land SHALL show the steps "1 Draw boundary" and "2 Add details". After the boundary is drawn, a Save land form SHALL ask for a name (required), show the computed area read-only, and offer an optional Water source (Borewell, Canal, River, Farm Pond, Rainfed) and notes. Discard SHALL drop the draft. After saving, a card SHALL offer Add crop and Not now.

#### Scenario: Save with water source
- **WHEN** the farmer saves a drawn land named "East" with water source "Canal"
- **THEN** the land is stored with that water source and appears in the list

#### Scenario: Name required
- **WHEN** the farmer saves without a name
- **THEN** an error is shown and nothing is saved

#### Scenario: Discard
- **WHEN** the farmer discards the draft
- **THEN** no land is created and the drawn boundary is removed

### Requirement: No lands yet
With no lands the page SHALL show an empty state "No lands yet" with a "Draw your first land" button, and no list.

#### Scenario: First visit
- **WHEN** a farmer with no lands opens Lands
- **THEN** the empty state is shown and its button starts drawing
