# market-price-data Specification

## Purpose
MyFarm keeps a daily record of mandi prices for the crops farmers grow, so a signed-in farmer can find mandis, follow a few, and read the latest price and its history.

## Requirements

### Requirement: Price intake
An admin-only operation SHALL accept a batch of mandi price rows, each with state, district, market, commodity, variety, grade, date, and minimum, maximum and modal price per quintal, and store one reading per mandi, commodity, variety, grade and day. Only rows for Maharashtra and for commodities that MyFarm crops map to SHALL be stored; other rows SHALL be ignored and counted. A row with a missing name, a bad date or a negative price SHALL be skipped and counted without failing the batch. A mandi seen for the first time SHALL be added. Sending the same rows again SHALL leave the stored readings unchanged. A batch of more than 5,000 rows, or a malformed body, SHALL be refused and nothing stored. Readings older than 400 days SHALL be removed after a successful batch. Without a valid admin token the operation SHALL be refused.

#### Scenario: First batch of the day
- **WHEN** a batch of 3 valid Maharashtra rows for a mapped commodity arrives
- **THEN** 3 readings are stored for their dates, any new mandis are added, and the reply counts 3 stored

#### Scenario: Same batch twice
- **WHEN** the same batch is sent a second time
- **THEN** the stored readings are the same as after the first batch

#### Scenario: Rows that do not belong
- **WHEN** a batch holds a Kerala row, a row for an unmapped commodity and a row with a bad date
- **THEN** none of them is stored and the reply counts each as ignored or skipped

#### Scenario: Too many rows
- **WHEN** a batch of 5,001 rows is sent
- **THEN** it is refused and nothing is stored

#### Scenario: No admin token
- **WHEN** the operation is called without the admin token
- **THEN** it is refused and nothing is stored

### Requirement: Commodities to fetch
An admin-only operation SHALL return the distinct commodity names that MyFarm crops map to, so the fetcher asks the feed for exactly those. Without a valid admin token it SHALL be refused.

#### Scenario: List
- **WHEN** crops map to Onion, Wheat and Maize
- **THEN** the operation returns those three names

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
