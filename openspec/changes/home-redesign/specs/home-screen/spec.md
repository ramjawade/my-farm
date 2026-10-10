# home-screen Specification

## Purpose
Home shows a signed-in farmer how the farm stands today: the weather, the work that needs doing, the key numbers and the crops.

## ADDED Requirements

### Requirement: Greeting header
Home SHALL greet the farmer by first name according to the time of day (morning, afternoon, evening), with a line showing the date and, when weather is available, the temperature and conditions. On a phone viewport an avatar with the farmer's initial SHALL appear before the greeting and open Profile. On a desktop viewport a "+ Log activity" button SHALL open the log-activity form.

#### Scenario: Morning greeting
- **WHEN** a farmer named "Ram Jawade" opens Home at 9 am
- **THEN** the header says "Good morning, Ram"

#### Scenario: Avatar on a phone
- **WHEN** the farmer selects the avatar on a phone viewport
- **THEN** Profile opens

### Requirement: Key tiles
Home SHALL show four tiles. Active crops SHALL show the number of active crops and "across N lands". Total area SHALL show the combined acres of all lands and the farm's village or district when known. Season spend SHALL show the total expenses logged in the current season and the date the season started. Next harvest SHALL show the days until the nearest expected harvest and that crop's name, or a dash when none is set.

#### Scenario: Numbers
- **WHEN** a farmer has 3 active crops on 2 lands totalling 5.5 acres and ₹12,000 of expenses this season
- **THEN** the tiles show 3 "across 2 lands", 5.5 acres and ₹12,000

#### Scenario: No harvest date
- **WHEN** no crop has an expected harvest date
- **THEN** the Next harvest tile shows a dash

### Requirement: Today's weather
Home SHALL show a weather card with the current temperature, conditions, humidity and wind, and a link to the full forecast. When daily forecast data is available it SHALL show the next three days. When the weather is sample data it SHALL say so, and when no location is set it SHALL offer to set one.

#### Scenario: Live weather
- **WHEN** weather for the farm's location has loaded
- **THEN** the card shows the temperature, conditions, humidity and wind

#### Scenario: No location
- **WHEN** the farmer has no land and no saved location
- **THEN** the card asks them to draw a land instead of showing weather

### Requirement: Needs attention
Home SHALL list up to four items that need attention, most urgent first: activities not completed or cancelled that are overdue or due within two days, and active crops with no completed activity for 7 days or more (counted from sowing when none was done). Each item SHALL show a badge (Overdue Nd, Today, Tomorrow, In 2 days, or N days) and open its activity or crop. When there are none it SHALL show "All clear".

#### Scenario: Overdue activity
- **WHEN** a scheduled activity was due 2 days ago
- **THEN** it appears first with the badge "Overdue 2d"

#### Scenario: Idle crop
- **WHEN** a crop's last completed activity was 9 days ago
- **THEN** it appears with the badge "9 days" and "No activity on <crop>"

#### Scenario: Nothing to do
- **WHEN** nothing is overdue, due soon or idle
- **THEN** the card shows "All clear"

### Requirement: Today's work
Home SHALL list the activities planned for today with a checkbox, and show "x of y done" with a progress bar. Checking an item SHALL mark that activity completed and the list SHALL update at once. With none planned it SHALL say nothing is planned today.

#### Scenario: Mark done
- **WHEN** the farmer checks an activity planned for today
- **THEN** the activity becomes Completed and the count and bar advance

### Requirement: Your farm
Home SHALL show a farm card listing crops with their icon, name, age, the four-step stage bar, days to harvest and expenses, up to two crops with a "View all" link to Crops when there are more. With no crops it SHALL say nothing is planted and link to Add crop.

#### Scenario: More than two crops
- **WHEN** the farm has 3 crops
- **THEN** two are shown with "Showing 2 of 3 crops" and View all

### Requirement: Responsive order
On a desktop viewport Home SHALL use two columns, with the farm and today cards on the left and the weather and attention cards on the right. On a phone viewport it SHALL use one column in the order weather, needs attention, today, your farm.

#### Scenario: Phone order
- **WHEN** Home is shown on a phone viewport
- **THEN** the weather card is first after the tiles and the farm card is last
