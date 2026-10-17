## MODIFIED Requirements

### Requirement: Add or edit a crop
The form SHALL ask for Season (Kharif, Rabi, Zaid), Crop name, Land (a saved land), Total surface area with a unit (hectares or acres), and Sowing date, all required, and optionally Irrigation type (Drip, Sprinkler, Flood, Manual) and Farming method (Organic, Conventional, Conservation Farming, Natural Farming). Crop name SHALL be chosen from the crop catalog list, grouped and searchable, with "Add new crop" offered when the typed name matches nothing. When opened with a land in the link, that land SHALL be preselected. Saving SHALL store all values, including the optional ones when chosen.

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

#### Scenario: Pick from the list
- **WHEN** a farmer with no crops opens Add crop and the Crop name list
- **THEN** the predefined crops appear in their groups and choosing Onion fills the field

#### Scenario: Add a missing crop
- **WHEN** the farmer types "Dragon fruit", which is not in the list
- **THEN** the list offers "Add new crop Dragon fruit" and choosing it fills the field with that name
