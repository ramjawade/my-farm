## ADDED Requirements

### Requirement: Slow start message
While the first load of a session is still running after 3 seconds, the loading overlay SHALL add one muted line under "Loading…": "The app runs on free hosting, so the first load can take up to a minute. Thanks for waiting." The line MUST NOT show when the first load finishes within 3 seconds. Once the first load has finished, the line MUST NOT show again in that session, whatever later requests do. The line SHALL be translated into Hindi and Marathi and SHALL be announced with the overlay's existing status text.

#### Scenario: Cold start
- **WHEN** the first request of a session is still running after 3 seconds
- **THEN** the overlay shows "Loading…" with the free-hosting line under it

#### Scenario: Fast start
- **WHEN** the first load finishes within 3 seconds
- **THEN** the overlay never shows the free-hosting line

#### Scenario: Line goes away with the overlay
- **WHEN** the slow first load finishes
- **THEN** the overlay closes with the line

#### Scenario: Later slow requests
- **WHEN** a request after the first load runs longer than 3 seconds
- **THEN** the overlay shows only "Loading…", without the free-hosting line

#### Scenario: Language
- **WHEN** the farmer's language is Hindi or Marathi
- **THEN** the line shows in that language
