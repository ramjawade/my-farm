# market-price-data Specification

## Purpose
MyFarm keeps a daily record of mandi prices for the crops farmers grow, so a signed-in farmer can find mandis, follow a few, and read the latest price and its history.

## ADDED Requirements

### Requirement: Daily price ingest
An admin-only operation SHALL fetch the day's mandi prices for Maharashtra and the commodities that MyFarm crops map to, and store one reading per mandi, commodity, variety, grade and day with its minimum, maximum and modal price per quintal. A mandi the feed reports for the first time SHALL be added. Running the operation again for the same day SHALL leave the stored readings unchanged. A failed fetch SHALL change nothing and report the failure. Readings older than 400 days SHALL be removed after a successful run. Without a valid admin token the operation SHALL be refused.

#### Scenario: First run of the day
- **WHEN** the operation runs and the feed returns 3 new rows
- **THEN** 3 readings are stored for today and any new mandis are added

#### Scenario: Run twice
- **WHEN** the operation runs a second time on the same day with the same rows
- **THEN** the stored readings are the same as after the first run

#### Scenario: Feed down
- **WHEN** the feed cannot be reached
- **THEN** earlier readings stay as they are and the failure is reported

#### Scenario: No admin token
- **WHEN** the operation is called without the admin token
- **THEN** it is refused and nothing is fetched

### Requirement: Find mandis
A signed-in farmer SHALL be able to list the Maharashtra districts that have mandis, and list mandis narrowed by district, by a partial, case-insensitive name search, and by whether the mandi has a price for a given commodity. Each mandi in the list SHALL show its name and district. The list SHALL be limited and ordered by name, and an empty search with no filters SHALL return the first mandis in that order. Mandis outside Maharashtra SHALL NOT be offered.

#### Scenario: Search by name
- **WHEN** the farmer searches "nash"
- **THEN** mandis whose name or district contains "nash" are returned, such as Nashik

#### Scenario: Narrow by district and crop
- **WHEN** the farmer picks the district Nashik and the commodity Onion
- **THEN** only Nashik-district mandis that have an onion price are returned

#### Scenario: Districts
- **WHEN** the farmer asks for the districts
- **THEN** the Maharashtra districts that have at least one mandi are returned in name order

#### Scenario: Nothing found
- **WHEN** the farmer searches for text no mandi matches
- **THEN** the list is empty

### Requirement: Chosen mandis
Each farmer SHALL have between one and five chosen mandis, kept in the order they chose them, and SHALL be able to replace the list. A list with none or more than five SHALL be refused. A farmer who has never chosen SHALL get up to three mandis in the district of their saved farm that have a price for one of their crops; when their farm has no district, the list is empty until they choose. A farmer's chosen mandis SHALL be visible only to that farmer.

#### Scenario: Choose mandis
- **WHEN** the farmer saves Nashik, Lasalgaon and Pimpalgaon
- **THEN** reading the list returns those three in that order

#### Scenario: Too many
- **WHEN** the farmer saves six mandis
- **THEN** the request is refused and the earlier list is kept

#### Scenario: Default
- **WHEN** a farmer in Nashik district who grows onion has never chosen
- **THEN** up to three Nashik-district mandis with an onion price are returned

### Requirement: Latest price for the farmer's crops
For each crop on the farmer's farm that maps to a price commodity, the API SHALL return its latest price at each chosen mandi, in rupees per quintal, with the date of the reading, the previous reading's price, and the percentage change. When several varieties or grades report on the same day, the commodity's price SHALL be the median of their modal prices. A mandi with no reading for that commodity SHALL be marked not traded. A crop with no price commodity SHALL be marked as having no price.

#### Scenario: Change from the previous reading
- **WHEN** onion at Lasalgaon was 2020 on the previous reading and is 2150 on the latest
- **THEN** the response shows 2150, the previous 2020 and a change of +6.4%

#### Scenario: Not traded
- **WHEN** a chosen mandi has never reported tomato
- **THEN** that mandi is marked not traded for the tomato crop

#### Scenario: Stale reading
- **WHEN** the latest reading is from three days ago
- **THEN** the response carries that date so the app can say it is not today's price

### Requirement: Price history
The API SHALL return a commodity's daily modal price at one mandi for the last 7, 30 or 365 days, oldest first, with only the days that have a reading. It SHALL also return the lowest, average and highest of those days. An unknown mandi or a period other than these SHALL be refused.

#### Scenario: Thirty days
- **WHEN** the farmer asks for 30 days of onion at Lasalgaon and 12 days have readings
- **THEN** 12 points are returned oldest first with their lowest, average and highest

#### Scenario: New history
- **WHEN** a mandi has only today's reading
- **THEN** one point is returned and no error

#### Scenario: Bad period
- **WHEN** the request asks for 14 days
- **THEN** it is refused
