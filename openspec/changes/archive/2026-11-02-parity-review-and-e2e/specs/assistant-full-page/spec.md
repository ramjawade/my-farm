## MODIFIED Requirements

### Requirement: Entry points
The sidebar SHALL list "Assistant" and mark it active on `/chat`. On wide screens the floating chat button SHALL NOT be shown on `/chat`, and SHALL stay on every other signed-in page. On phones there is no separate floating chat button: the assistant opens from "Ask assistant" in the quick-actions button on the screens that show it, and is not offered on `/chat` or on pages that have a parent page. The overlay SHALL have a control that opens `/chat`.

#### Scenario: Sidebar
- **WHEN** the farmer taps "Assistant" in the sidebar
- **THEN** `/chat` opens and the item is shown as current

#### Scenario: Expand from the overlay
- **WHEN** the farmer taps the expand control in the overlay
- **THEN** `/chat` opens, the overlay closes and the same conversation is shown

#### Scenario: Floating button on the page
- **WHEN** the farmer is on `/chat`
- **THEN** no floating chat button is shown

#### Scenario: Assistant on a phone
- **WHEN** a farmer on a phone is on Crops and chooses "Ask assistant" from the quick-actions button
- **THEN** the assistant overlay opens over the same conversation
