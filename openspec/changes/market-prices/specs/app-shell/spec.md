## MODIFIED Requirements

### Requirement: Wide screens show a fixed sidebar
At 992 px and wider, the signed-in app SHALL show a fixed sidebar on the left with the logo and app name, the main section links, and an account block at the bottom. The account block SHALL show the farmer's initial, name and village or area, and SHALL open Profile. The app SHALL NOT show a top toolbar.

#### Scenario: Sidebar contents
- **WHEN** a signed-in farmer opens any screen on a wide screen
- **THEN** the sidebar lists Home, Lands, Crops, Activity, Reports, Prices and Weather in that order, and the account block shows their initial and name

#### Scenario: Open Profile from the account block
- **WHEN** the farmer selects the account block
- **THEN** the Profile screen opens and the account block shows as current

#### Scenario: Current section on a child page
- **WHEN** the farmer opens a crop's detail page
- **THEN** Crops is highlighted in the sidebar

#### Scenario: Current section on a price page
- **WHEN** the farmer opens a crop's price detail
- **THEN** Prices is highlighted in the sidebar

### Requirement: Phones show a bottom tab bar
Under 992 px, the signed-in app SHALL show a bottom tab bar, always visible, with the main sections Home, Lands, Crops, Activity, Reports and Prices. The current section SHALL be highlighted and exposed as the current page. The app SHALL NOT show a hamburger button or a slide-in menu. Page content and floating buttons SHALL NOT be hidden behind the tab bar.

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
- **WHEN** a screen shows the chat button or add buttons on a phone
- **THEN** they sit above the tab bar, not under it, and the last item of the page can be scrolled fully into view

#### Scenario: Weather on a phone
- **WHEN** a farmer on a phone wants the weather
- **THEN** they reach it from the Home weather card, since Weather has no tab
