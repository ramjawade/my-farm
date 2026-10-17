# Tasks

## 1. Verify the feed

- [ ] 1.1 From an Indian IP with the real key, confirm the maximum `limit` and the feed's exact spelling of Maharashtra and of our crops' commodities (the fetcher's first run reports them). Render and GitHub's US runners are refused, so this runs on the self-hosted runner.

## 2. Schema

- [x] 2.1 Add the `Mandi`, `PriceReading` and `FarmerMandi` models and `price_commodity` on `CropCatalog`, with migration `0009` (unique keys, indexes on mandi and date, and commodity names set for the shipped crops)

## 3. Ingest

- [x] 3.1 Add the feed client and ingest service: fetch Maharashtra rows per mapped commodity, upsert mandis and readings, prune readings older than 400 days, log commodities that matched nothing
- [x] 3.2 Add `POST /api/v1/admin/prices/ingest` behind the admin token
- [x] 3.3 Add pytest cases against the saved fixture: first run, rerun gives the same rows, feed failure changes nothing, no token is refused, retention pruning

## 4. Read API

- [x] 4.1 Add `GET /api/v1/mandis/districts`, `GET /api/v1/mandis` (district, name and commodity filters, Maharashtra only) and `GET`/`PUT /api/v1/me/mandis` (one to five, ordered, default from the farm's district), tenant-scoped
- [x] 4.2 Add `GET /api/v1/prices/latest` (best data per chosen mandi and crop, median across varieties, previous reading, change, reading date, not traded, no price) and `GET /api/v1/prices/history` (7, 30 or 365 days with lowest, average, highest)
- [x] 4.3 Add pytest cases for the spec scenarios, including that one farmer cannot read or change another's chosen mandis

## 5. Trigger and setup

- [x] 5.1 Add the scheduled `price-ingest` GitHub Actions workflow with retry and a manual run, and document the repository secrets and the Render feed-key variable in `BACKEND_PLAN.md`
- [x] 5.2 Regenerate `openapi.json` and the TypeScript types (`npm run generate:contracts`)

## 6. Fetch from India, push rows

Replaces the pull-based ingest of 3.2 and the workflow of 5.1, which cannot reach the feed.

- [ ] 6.1 Split storage from fetching: add `POST /api/v1/admin/prices/rows` (validates, at most 5,000 rows, ignores other states and unmapped commodities, skips bad rows, returns counts, prunes) and `GET /api/v1/admin/prices/commodities`; remove the pull endpoint, the `MandiFeed` client and the Render feed settings
- [ ] 6.2 Add pytest cases for the intake scenarios: first batch, same batch twice, rows that do not belong, too many rows, no admin token, and the commodity list
- [ ] 6.3 Add `scripts/fetch-mandi-prices.mjs` (Node, no dependencies): read the commodity names, page through the feed with `offset` and `limit`, post batches, print clear errors that never include the key, with `node --test` cases for row mapping and paging
- [ ] 6.4 Rework `price-ingest.yml` to run on a self-hosted runner labelled `india` for `schedule` (twice a day) and `workflow_dispatch` only, using the secrets `PRICE_INGEST_ADMIN_TOKEN` and `MANDI_API_KEY`
- [ ] 6.5 Document in `BACKEND_PLAN.md` §9.1 how to register the runner, the secrets, the pull-request safety rule and the repository approval setting
- [ ] 6.6 Regenerate `openapi.json` and the TypeScript types

## 7. Finish

- [ ] 7.1 Run `ruff`, `mypy` and `pytest`, and `npm run lint` and `npm run build`
- [ ] 7.2 Register the runner on your PC, add the two secrets, run the workflow once and send the result so task 1.1 can be closed
- [ ] 7.3 Archive this change on its PR branch once CI is green and the first run has stored prices, and tick task 4.2a in `prototype-adoption-roadmap/tasks.md`
