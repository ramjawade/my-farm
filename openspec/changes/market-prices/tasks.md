# Tasks

`market-price-data` is merged and prices are being stored daily, so this can be built and checked against real data.

## 1. Data and shell

- [ ] 1.1 Add `PricesService` over the generated contracts (`latest`, `history`, `chosenMandis`, `saveMandis`, `districts`, `findMandis`) with a spec
- [ ] 1.2 Add `prices.utils.ts` (one row per crop type, best price, percentage change, average badge, period figures) with specs
- [ ] 1.3 Add the Prices entry to `NAV_ITEMS` (sidebar after Reports, phone tab), the `prices` routes with `section`, `parent` and title keys, and update the nav and shell specs

## 2. Screens

- [ ] 2.1 Build the Prices page: crop rows, change, stale and "Updated" states, "No price", "Not traded", empty farm, expand to chosen mandis with "Best" badge
- [ ] 2.2 Build `PriceChartComponent` (one to four lines, themed, accessible label and text alternative) with a spec
- [ ] 2.3 Build the Price detail page: latest price card, average badge, period control (7, 30, 365 days), figures, short-history note, mandi chips, Compare card with the three-line limit
- [ ] 2.4 Build the My APMCs page: chosen list with remove and "Keep one", finder with District filter, name search and "trades my crops" switch, five-mandi limit, suggested defaults for a first visit, save and return
- [ ] 2.5 Add loading, error with Retry, and the "pick a mandi" redirect for farmers with no district and no chosen mandi

## 3. Language and checks

- [ ] 3.1 Add i18n keys for mr, hi and en and pass `scripts/check-translations.mjs`
- [ ] 3.2 Add component specs for the three pages, covering the spec scenarios
- [ ] 3.3 Check the phone tab bar at 360 px with Marathi labels and shorten the Prices label if it wraps

## 4. Finish

- [ ] 4.1 Run `npm run lint` and `npm run build`
- [ ] 4.2 Open the PR naming `market-prices`
- [ ] 4.3 After the PR merges, archive this change (which syncs the `app-shell` delta and adds `market-prices-screens`) and tick task 4.2b in `prototype-adoption-roadmap/tasks.md`
