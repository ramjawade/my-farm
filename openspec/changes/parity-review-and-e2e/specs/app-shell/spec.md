## ADDED Requirements

### Requirement: Phones show one quick-actions button
Under 992 px, a signed-in screen that has no parent page (Home, Lands, Crops, Activity, Reports, Prices, Weather) SHALL show one round button at the bottom right, above the tab bar. It SHALL replace the separate floating buttons: there SHALL be no floating assistant button, no floating add button and no floating back button on phones. Where the screen has more than one action the button SHALL open a menu of labelled actions with a dimmed backdrop and a close control; where it has one action the button SHALL do that action directly. The actions SHALL be, in order: Home: Log activity, Add expense, Add crop, Draw land, Ask assistant; Lands: Draw land, Add crop, Ask assistant; Crops: Add crop, Log activity, Ask assistant; Activity: Log activity, Add expense, Ask assistant; Reports, Prices and Weather: Ask assistant. The button SHALL NOT be shown on the Assistant page, on any page that has a parent page (including add, edit and detail pages), while a land is being drawn, or on wide screens. Choosing an action SHALL close the menu. The back arrow of a page with a parent SHALL be only the one in the header.

#### Scenario: Several actions
- **WHEN** a farmer on a phone opens the button on Home
- **THEN** a menu lists Log activity, Add expense, Add crop, Draw land and Ask assistant, and the page behind is dimmed

#### Scenario: One action
- **WHEN** a farmer on a phone is on Prices
- **THEN** the button opens the assistant directly

#### Scenario: Choosing an action
- **WHEN** the farmer chooses Add crop from the menu
- **THEN** the menu closes and the Add crop screen opens

#### Scenario: Not on sub-screens or the assistant
- **WHEN** a farmer on a phone is on Add crop, an activity's detail, or the Assistant page
- **THEN** no quick-actions button is shown

#### Scenario: Not while drawing
- **WHEN** a farmer on a phone is drawing a land
- **THEN** no quick-actions button is shown

#### Scenario: No floating back button
- **WHEN** a farmer on a phone opens Lands, Crops, Reports, Weather or an activity page
- **THEN** there is no floating back arrow; going back is the arrow in the header

#### Scenario: Close the menu
- **WHEN** the menu is open and the farmer selects the close control or the dimmed backdrop
- **THEN** the menu closes

#### Scenario: Wide screens
- **WHEN** the screen is 992 px or wider
- **THEN** no quick-actions button is shown

## MODIFIED Requirements

### Requirement: Phones show a bottom tab bar
Under 992 px, the signed-in app SHALL show a bottom tab bar, always visible, with the main sections Home, Lands, Crops, Activity, Reports and Prices. The current section SHALL be highlighted and exposed as the current page. The app SHALL NOT show a hamburger button or a slide-in menu. Page content and the quick-actions button SHALL NOT be hidden behind the tab bar.

#### Scenario: One tap between sections
- **WHEN** a farmer on a phone selects the Crops tab
- **THEN** the Crops screen opens in one tap and the Crops tab shows as current

#### Scenario: Prices tab
- **WHEN** a farmer on a phone selects the Prices tab
- **THEN** the Prices screen opens and the Prices tab shows as current

#### Scenario: Tab bar stays in view
- **WHEN** the farmer scrolls a long page
- **THEN** the tab bar stays at the bottom of the screen

#### Scenario: Floating buttons clear the tab bar
- **WHEN** a screen shows the quick-actions button on a phone
- **THEN** it sits above the tab bar, not under it, and the last item of the page can be scrolled fully into view

#### Scenario: Weather on a phone
- **WHEN** a farmer on a phone wants the weather
- **THEN** they reach it from the Home weather card, since Weather has no tab
