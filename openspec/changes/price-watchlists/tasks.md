# Tasks

Applying starts after `market-prices` (#385) is merged, because it extends those screens.

## 1. Backend

- [ ] 1.1 Add the `Watchlist` and `WatchlistItem` models and migration `0011` (unique name per farmer ignoring case, unique crop and market per list, items deleted with their list)
- [ ] 1.2 Move the latest-and-previous price logic into a shared helper and use it from `GET /prices/latest`, keeping its tests green
- [ ] 1.3 Add the watchlists router: list, create (name rules, reserved "My farm", limit of 10), delete, add item (price commodity required, duplicate and limit of 20) and remove item, all tenant-scoped through the list
- [ ] 1.4 Add `GET /prices/crops/{crop_catalog_id}/markets` (best first, limit, includes price and date) and `has_price` on the crop list
- [ ] 1.5 Add pytest cases for the spec scenarios, including a cross-tenant 404 on every watchlist route
- [ ] 1.6 Regenerate `openapi.json` and the TypeScript types

## 2. Frontend

- [ ] 2.1 Add `WatchlistsService` and extend the Prices page resolver to load the watchlists, with specs
- [ ] 2.2 Add the tab row to the Prices page ("My farm", one tab per list with its count, "+ New list") with the chosen list in the link
- [ ] 2.3 Extract the price row (price, change, "Updated", "Not traded") into a small shared component and show a list's items with it, with remove and the delete-list confirmation
- [ ] 2.4 Build the New list page and the Add item page (crop, then market best first) with the spec's validation messages and limits
- [ ] 2.5 Make the price detail work for a crop the farmer does not grow, using the markets endpoint, and update its tests
- [ ] 2.6 Add i18n keys for mr, hi and en and pass `scripts/check-translations.mjs`
- [ ] 2.7 Add component specs for the scenarios in the spec

## 3. Finish

- [ ] 3.1 Run `ruff`, `mypy`, `pytest`, `npm run lint` and `npm run build`
- [ ] 3.2 Open the draft PR naming `price-watchlists` (done with the plan) and have the user look at lists on desktop and a phone
- [ ] 3.3 Archive this change on the PR branch once CI is green (it adds the `price-watchlists` spec) and tick task 4.3a in `prototype-adoption-roadmap/tasks.md`
