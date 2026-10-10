# farmer-profile Specification

## Purpose
The Profile screen lists the farmer's account, location and app settings as rows, and edits one row at a time.

## ADDED Requirements

### Requirement: Profile shows a header and grouped setting rows
The Profile screen SHALL show a back link to Home, a header with the farmer's initial, name, phone, role and member-since date, then three groups of rows: Account (full name, phone, email, role), Location (village, district and state, pincode) and App (language, theme). A Sign out button SHALL follow the groups. An empty row SHALL show "Add" in place of a value.

#### Scenario: Rows shown
- **WHEN** a signed-in farmer opens Profile
- **THEN** the three groups and their rows are shown with the stored values, and empty values show "Add"

#### Scenario: Phone is read-only
- **WHEN** the farmer looks at the phone row
- **THEN** it has no edit control and explains that the phone is the sign-in

### Requirement: One field is edited at a time
Selecting a row SHALL open a dialog for that field alone, with its help text, Save and Cancel. The dialog SHALL be centred on a desktop viewport and a bottom sheet on a phone viewport. Escape, the scrim and Cancel SHALL close it without saving.

#### Scenario: Edit a field
- **WHEN** the farmer selects Email, enters a valid address and saves
- **THEN** the dialog closes, the row shows the new value and a confirmation toast appears

#### Scenario: Invalid value
- **WHEN** the farmer saves a pincode that is not 6 digits, or an email that is not an address, or an empty name
- **THEN** the dialog stays open and shows the error, and nothing is saved

#### Scenario: Save fails
- **WHEN** the save request fails
- **THEN** the dialog stays open with an error and the entered value is kept

#### Scenario: Phone viewport
- **WHEN** the dialog opens on a phone-width screen
- **THEN** it appears as a bottom sheet

### Requirement: Missing details are suggested
When email, village, district and state, or pincode is empty, Profile SHALL show a banner naming the first missing field and how many are left, with an Add action that opens that field's dialog. The banner SHALL disappear once all are filled.

#### Scenario: Banner shown
- **WHEN** a farmer has no email and no pincode
- **THEN** the banner says "2 details left" and Add opens the email dialog

#### Scenario: Nothing missing
- **WHEN** all four are filled
- **THEN** no banner is shown

### Requirement: Language and theme apply at once
Choosing a language or a theme in its dialog SHALL apply it immediately and keep it as before (language on the farmer, theme on the device).

#### Scenario: Change language
- **WHEN** the farmer saves Marathi in the language dialog
- **THEN** the screen text switches to Marathi and the choice is stored on the farmer

### Requirement: Farm and farming details are not on Profile
Profile SHALL NOT show or edit farm name, farm area, primary crops, water source, irrigation or farming method, and SHALL NOT offer section Delete buttons.

#### Scenario: Old fields gone
- **WHEN** Profile is open
- **THEN** none of those fields or Delete buttons appear
