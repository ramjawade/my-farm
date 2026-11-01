# banners Specification

## Purpose
TBD - created by archiving change banners-and-notifications. Update Purpose after archive.

## Requirements

### Requirement: One banner for everything the app tells the farmer
The app SHALL show notices in one shared banner: a white card with a 1px border and the same corner radius as other cards, an icon chip tinted by kind, a small capitalised kind label, a bold title, one muted line, and an optional single link action. Four kinds SHALL exist: Problem, Warning, Update and New. The kind SHALL change only the chip tint, the icon and the label; only a Problem SHALL have a coloured (rose) border. A Problem SHALL be announced as an alert; the others as a status.

#### Scenario: A problem
- **WHEN** a Problem banner is shown
- **THEN** it has a rose border, the label in rose, and is announced as an alert

#### Scenario: Other kinds
- **WHEN** a Warning, Update or New banner is shown
- **THEN** it has the normal card border and only its icon chip and label carry the kind colour

### Requirement: Dismissing
A Problem banner MUST NOT have a dismiss button and SHALL stay until its cause is gone. Warning, Update and New banners SHALL have a dismiss button. A New banner SHALL be shown once: after it is dismissed it does not return.

#### Scenario: Problem cannot be dismissed
- **WHEN** the device is offline
- **THEN** the offline banner has no dismiss button and disappears by itself when the connection returns

#### Scenario: Dismiss an update
- **WHEN** the farmer dismisses the "New version available" banner
- **THEN** it disappears

### Requirement: Dismissed stays dismissed until the content changes
A dismissed banner SHALL stay hidden for that farmer, on that device, across reloads and sign-outs, until its title or text changes, after which it SHALL show again. Dismissals SHALL be kept per farmer, so one farmer's dismissals do not hide banners for another farmer on the same device. If storage is not available the banner SHALL still dismiss for the rest of the session.

#### Scenario: Stays dismissed
- **WHEN** the farmer dismisses a banner and reloads the app
- **THEN** the banner is not shown again

#### Scenario: Content changes
- **WHEN** a dismissed banner's text changes
- **THEN** it shows again

#### Scenario: Another farmer
- **WHEN** a second farmer signs in on the same device
- **THEN** the first farmer's dismissals do not hide banners for them

### Requirement: Stacking
At the top of a screen the app SHALL show at most two banners, ordered Problem first, then Warning, then Update, then New (banners of the same kind keep the order they were added). When more than two are active, the rest SHALL fold into one dashed row reading "N more notifications" with a "View all" action. "View all" SHALL show every active banner in place with a "Show less" row that folds them back, and SHALL NOT open another screen. When a screen changes the list SHALL fold back to two.

#### Scenario: Two shown
- **WHEN** four banners are active on Home
- **THEN** the first two by order show, followed by "2 more notifications"

#### Scenario: View all
- **WHEN** the farmer selects "View all"
- **THEN** all four banners show in place with "Show less"

#### Scenario: A problem comes first
- **WHEN** a Problem and three other banners are active
- **THEN** the Problem is the first banner shown

#### Scenario: One more
- **WHEN** three banners are active
- **THEN** the row reads "1 more notification"

### Requirement: Where banners show
A banner SHALL show on the screens it belongs to: Home and the screen it is about. A Problem such as offline SHALL show on every screen, including the signed-out screens. The banners SHALL sit at the top of the page content, above the page, without covering the header or tab bar.

#### Scenario: Weather notice only on Weather
- **WHEN** the weather is sample data
- **THEN** the sample-data banner shows on Weather and not on Prices

#### Scenario: Offline everywhere
- **WHEN** the device goes offline on any screen
- **THEN** the offline banner shows at the top of that screen

### Requirement: First notices
The offline notice SHALL be a Problem banner labelled "Offline", titled "You are offline", with the line "Saved screens still open, but changes need a connection.". While the weather shown is sample data the Weather screen SHALL show an Update banner "Weather shows sample data" with a line saying the live forecast is unavailable. When the service worker has a new version of the app ready, Home SHALL show an Update banner "New version available" with an "Update now" action that reloads the app on the new version.

#### Scenario: Sample weather
- **WHEN** the live forecast is unavailable and Weather shows demo figures
- **THEN** Weather shows the "Weather shows sample data" banner

#### Scenario: New version
- **WHEN** a new app version is ready and the farmer is on Home
- **THEN** "New version available" shows with "Update now", and selecting it reloads the app

### Requirement: Words and accessibility
All banner labels, titles, lines and actions SHALL be available in English, Hindi and Marathi. The link action and the dismiss button SHALL be real buttons reachable by keyboard, and the dismiss button SHALL name the banner it dismisses.

#### Scenario: Marathi
- **WHEN** the language is Marathi
- **THEN** the offline banner reads in Marathi

#### Scenario: Keyboard
- **WHEN** the farmer tabs to a banner's dismiss button and presses Enter
- **THEN** the banner is dismissed
