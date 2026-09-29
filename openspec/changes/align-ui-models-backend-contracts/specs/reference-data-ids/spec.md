## ADDED Requirements

### Requirement: Domain models reference data by id
Domain entities SHALL hold backend reference-table FK ids (`cropCatalogId`, `activityTypeId`, `expenseCategoryId`, all `number`) instead of resolved name strings.

#### Scenario: Crop read from backend
- **WHEN** a crop with `crop_catalog_id: 7` is mapped from the backend
- **THEN** the resulting `CropEntity.cropCatalogId` is `7`
- **AND** no reference-data lookup is performed during mapping

#### Scenario: Crop written to backend
- **WHEN** a crop with `cropCatalogId: 7` is mapped to the backend
- **THEN** the payload contains `crop_catalog_id: 7`

#### Scenario: Activity and expense round-trip
- **WHEN** an activity with `activityTypeId` and an expense with `expenseCategoryId` are mapped to the backend and back
- **THEN** both ids are unchanged and the mappers do not await `ReferenceDataService`

### Requirement: Display names resolve at render time
Names for reference ids SHALL be resolved when rendering, through `ReferenceNamePipe` or a synchronous cached lookup, with the existing translation and raw-name fallback rules.

#### Scenario: Seeded name is translated
- **WHEN** a crop with a seeded catalog id is displayed in a translated language
- **THEN** the translated crop name is shown

#### Scenario: Farmer-added reference name
- **WHEN** an id belongs to a farmer-created reference entry with no translation key
- **THEN** the stored raw name is shown, never a blank or the id

#### Scenario: Language switch
- **WHEN** the language changes at runtime
- **THEN** displayed reference names update without reloading

### Requirement: Forms bind to ids
Selection controls for crop, activity type and expense category SHALL bind to the reference id and show the resolved name as the option label.

#### Scenario: Adding a crop
- **WHEN** the farmer picks a crop in the add-crop form
- **THEN** the created crop has `cropCatalogId` equal to the chosen catalog entry's id

#### Scenario: Farmer-typed crop not in the catalog
- **WHEN** the farmer enters a crop name that has no catalog entry
- **THEN** a catalog entry is created (create-or-get) and its id is used

### Requirement: No behaviour regression
Migrating to ids SHALL NOT change user-visible labels, filtering, sorting, report grouping or persistence.

#### Scenario: Reports grouping
- **WHEN** a season report groups expenses by category
- **THEN** groups and their labels match those produced before the migration

### Requirement: Reference cache loads without blocking sign-in
The reference-data cache SHALL load without blocking sign-in and include entries the farmer creates in the session. It SHALL NOT poll or refetch on a miss.

#### Scenario: Non-blocking preload
- **WHEN** a session is issued at login
- **THEN** sign-in completes without waiting for reference data
- **AND** pages that show names wait for the shared `ready` promise together with their own data

#### Scenario: Farmer adds an entry
- **WHEN** the farmer creates a crop or activity type
- **THEN** its name resolves from the cache immediately, with no extra fetch

#### Scenario: Unknown id
- **WHEN** an id is not in the cache
- **THEN** its name is an empty string, not an error
- **AND** no extra request is made
