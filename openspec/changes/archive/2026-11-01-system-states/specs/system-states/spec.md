## ADDED Requirements

### Requirement: Page not found
An address the app does not know SHALL show a card with an icon, the title "This page isn't here", the line "The link may be old or mistyped." and a primary "Go to Home" button, inside the normal app shell. Selecting "Go to Home" SHALL open Home. The card MUST NOT show technical words or codes.

#### Scenario: Unknown address
- **WHEN** the farmer opens an address the app does not have
- **THEN** the card shows "This page isn't here" and "Go to Home" with the sidebar or tab bar still in place

#### Scenario: Go home
- **WHEN** the farmer selects "Go to Home"
- **THEN** Home opens

### Requirement: Could not load
When a page cannot load what it needs, it SHALL show one shared card with a warning icon, the title "Something went wrong", a line saying to check the connection and try again, and a primary "Try again" button. Selecting "Try again" SHALL repeat that page's own load, and on success the page SHALL replace the card with its content. The activity page SHALL use this card in place of its own error box.

#### Scenario: Failed load
- **WHEN** the activity page cannot load the activity
- **THEN** it shows "Something went wrong" and "Try again"

#### Scenario: Try again
- **WHEN** the farmer selects "Try again" and the load now succeeds
- **THEN** the activity shows in place of the card

#### Scenario: Still failing
- **WHEN** the load fails again
- **THEN** the same card stays and the farmer can try again

### Requirement: Loading a page
While a page loads its content, it SHALL show one shared card with a spinner, the text "Loading…" and one short line, announced to assistive technology as a status. The spinner SHALL turn only when the device allows motion. The pages that show a full-page spinner SHALL use this card.

#### Scenario: Loading
- **WHEN** the prices list is loading
- **THEN** the loading card shows with "Loading…"

#### Scenario: Motion not wanted
- **WHEN** the device asks for reduced motion
- **THEN** the spinner is shown without turning

### Requirement: Loading after an action
While a request the farmer started is running, the app SHALL show the centred loading overlay with the translated text "Loading…" over a light scrim, and SHALL hide it when no request is running. Its colours SHALL come from the design tokens.

#### Scenario: Saving
- **WHEN** the farmer saves an activity
- **THEN** the overlay shows until the request finishes and then disappears

#### Scenario: Another language
- **WHEN** the language is Marathi
- **THEN** the overlay text is in Marathi

### Requirement: Offline notice
While the device is offline, every screen SHALL show a banner at the top with the label "Offline", the title "You are offline" and the line "Saved screens still open, but changes need a connection." The banner SHALL be announced as an alert, SHALL NOT be dismissible, and SHALL disappear by itself when the connection returns.

#### Scenario: Goes offline
- **WHEN** the device loses its connection while the farmer is on Home
- **THEN** the offline banner appears at the top of Home

#### Scenario: On another screen
- **WHEN** the farmer opens Crops while offline
- **THEN** the same banner shows at the top of Crops

#### Scenario: Back online
- **WHEN** the connection returns
- **THEN** the banner disappears without any action

#### Scenario: Cannot be dismissed
- **WHEN** the banner is shown
- **THEN** it has no close button

### Requirement: States are translated and accessible
Every line of these states SHALL be available in English, Hindi and Marathi. Their buttons SHALL be reachable and usable by keyboard, and the loading and offline states SHALL be announced to assistive technology.

#### Scenario: Marathi
- **WHEN** the language is Marathi and an address is unknown
- **THEN** the title, line and button are in Marathi

#### Scenario: Keyboard
- **WHEN** the farmer tabs to "Try again" and presses Enter
- **THEN** the load is repeated
