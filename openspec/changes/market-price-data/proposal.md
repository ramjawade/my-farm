## Why

The Prices screens (roadmap 4.2) need real mandi prices and a history to chart, and nothing in MyFarm holds either. Mandi prices are published once a day, so a history exists only if we store each day's reading ourselves. This change builds that data layer first, so history is already building while the screens (`market-prices`) are made. History starts from the first day the job runs; nothing is backfilled.

## What Changes

- **Price source:** a daily pull of mandi prices (minimum, maximum and modal, in rupees per quintal, per market, commodity, variety and grade) from the government open-data mandi feed, limited to Maharashtra and to the commodities MyFarm's crops map to. The feed's contract is recorded in the design; its maximum page size and exact commodity spellings are checked first (task 1.1).
- **Tables:** `mandi` (state, district, name), `price_reading` (one row per mandi, commodity, variety, grade and day, with min, max and modal), `farmer_mandi` (the mandis a farmer follows), and a `price_commodity` name on `crop_catalog` so a crop maps to a feed commodity.
- **Mandis come from the feed.** There is no hand-seeded list: a mandi is added when the feed first reports it, and the farmer finds theirs by searching name or district.
- **Daily ingest:** an admin-protected endpoint fetches and stores the day's prices. Running it twice in a day changes nothing. Readings older than 400 days are removed so the database stays small.
- **Trigger:** a scheduled GitHub Actions workflow calls the endpoint once a day, which keeps the job on free tiers (Render's free web service sleeps and has no free scheduler).
- **Read API** (signed-in farmers): search mandis, read and set the farmer's chosen mandis (one to five), the latest price for the farmer's crops at those mandis, and a price history for one commodity at one mandi over 7, 30 or 365 days.
- **Default mandis:** a farmer with none chosen sees up to three mandis in their district that trade their crops. With no district saved, none are chosen until they pick.
- **No distance.** The feed has no coordinates, so there are no "km away" figures; mandis show their district instead.

Prototype screens this feeds: `prices`, `pricedetail`, `apmcs` in `design/prototype/myfarm-prototype.html`. No UI is added here.

## Capabilities

### New Capabilities
- `market-price-data`: mandis, daily price readings, price history and the farmer's chosen mandis, served through the API.

### Modified Capabilities
- none

## Impact

- Backend: models and migration `0009`, a seed of commodity names on `crop_catalog`, repositories, an ingest service, an admin endpoint, farmer endpoints, tests, `openapi.json`.
- CI: a scheduled workflow `.github/workflows/price-ingest.yml` and two repository secrets (admin token, API base URL).
- Config: the data-feed API key as a Render environment variable.
- Frontend: only the regenerated API types.
- Cost: inside the free tiers. About a thousand rows a day is roughly 40 to 80 MB a year with indexes in Neon (0.5 GB free), capped by the 400-day retention.

## Non-goals

- Any screen, banner or chart (`market-prices`).
- Price alerts and watchlists (4.3).
- Backfilling history, intraday prices, or prices outside Maharashtra.
- Distance to a mandi.

## Data flow

```mermaid
flowchart TD
  A[GitHub Actions, daily] --> B[POST admin ingest on Render]
  B --> C{Feed reachable?}
  C -- no --> D[Report the failure, keep earlier prices]
  C -- yes --> E[Fetch Maharashtra rows for mapped commodities]
  E --> F[Add new mandis, upsert price_reading by day]
  F --> G[Remove readings older than 400 days]
  G --> H[Farmer opens Prices]
  H --> I[Read API: latest price, history, search mandis]
```
