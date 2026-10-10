# crops-screen Specification

## Purpose
The Crops screens list the farmer's crops, show one crop's progress and costs, and add or edit a crop.

## ADDED Requirements

### Requirement: Crop cards
The Crops page SHALL show one card per crop with a crop-type icon, name, plot (the land's name), age in days since sowing, area, a four-step stage bar, and a badge with the number of activities. Selecting a card SHALL open the crop's detail. Search SHALL filter the cards by crop name.

#### Scenario: Card content
- **WHEN** a farmer has an Onion crop on land "North", sown 12 days ago, with 5 activities
- **THEN** its card shows Onion, North, 12 days, its area, the stage bar and "5 activities"

#### Scenario: Open detail
- **WHEN** the farmer selects a card
- **THEN** that crop's detail page opens

### Requirement: Four-step stage display
The stage bar SHALL have four steps: Sowing, Growth, Flowering and Harvest. The crop's stored stage SHALL map to a step: Land Preparation, Sowing and Germination to Sowing; Vegetative Growth to Growth; Flowering and Fruiting / Pod Formation to Flowering; Maturity and Harvest to Harvest. Steps up to the current one SHALL be marked, and the bar SHALL have a text alternative naming the step.

#### Scenario: Mapping
- **WHEN** a crop's stage is Fruiting / Pod Formation
- **THEN** the bar shows step 3 of 4, Flowering

### Requirement: Crop actions
Each card SHALL have a menu with Edit crop and Delete crop. Delete SHALL ask for confirmation first and, once confirmed, remove the crop and its card.

#### Scenario: Delete
- **WHEN** the farmer confirms Delete crop
- **THEN** the crop is removed and a confirmation message appears

#### Scenario: Edit
- **WHEN** the farmer selects Edit crop
- **THEN** the form opens with that crop's values filled in

### Requirement: No crops yet
With no crops the page SHALL show a "No crops yet" empty state with an Add crop button.

#### Scenario: Empty
- **WHEN** a farmer with no crops opens Crops
- **THEN** the empty state is shown and Add crop opens the form

### Requirement: Crop detail
The detail page SHALL show a back link "All crops", a header with the crop name and a line with its land (linking to Lands), stage, irrigation type and farming method when set, and a Log activity button. It SHALL show a Stage card, tiles for Age, Activities (done and planned), Crop cost and Area, an Activities card with All, Upcoming and Recent chips, and a Timeline card.

#### Scenario: Tiles
- **WHEN** a crop is 30 days old with 3 completed and 2 planned activities and ₹4,000 in expenses
- **THEN** the tiles show 30 days, 5 activities with 3 done and 2 planned, and ₹4,000

#### Scenario: Optional line parts
- **WHEN** a crop has no irrigation type and no farming method
- **THEN** the header line shows only land and stage

#### Scenario: Activity filter
- **WHEN** the farmer selects the Upcoming chip
- **THEN** only planned activities are listed and the chip shows their count

#### Scenario: Advance stage
- **WHEN** the farmer advances the stage from the Stage card
- **THEN** the bar moves and the crop's stored stage advances to the next of the eight

### Requirement: Add or edit a crop
The form SHALL ask for Season (Kharif, Rabi, Zaid), Crop name, Land (a saved land), Total surface area with a unit (hectares or acres), and Sowing date, all required, and optionally Irrigation type (Drip, Sprinkler, Flood, Manual) and Farming method (Organic, Conventional, Conservation Farming, Natural Farming). When opened with a land in the link, that land SHALL be preselected. Saving SHALL store all values, including the optional ones when chosen.

#### Scenario: Create with optional fields
- **WHEN** the farmer fills the required fields, chooses Drip and Organic, and saves
- **THEN** the crop is created with irrigation type Drip and farming method Organic

#### Scenario: Create without optional fields
- **WHEN** the farmer leaves irrigation and farming method as Not set
- **THEN** the crop is created with both empty

#### Scenario: Required fields
- **WHEN** the farmer saves with a missing required field
- **THEN** the form shows an error on that field and nothing is saved

#### Scenario: Edit
- **WHEN** the farmer changes the irrigation type of an existing crop and saves
- **THEN** the crop shows the new value and the detail header reflects it

#### Scenario: No lands
- **WHEN** the farmer has no saved lands
- **THEN** the Land field is disabled and says to draw a land first
