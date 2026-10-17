# Tasks

## 1. Verify the feed

- [ ] 1.1 With a real key, confirm the maximum `limit`, the feed's exact spelling of Maharashtra and of our crops' commodities, and that a call works from Render. Trim the 17 Oct 2026 sample response into a test fixture. If the API is unavailable, stop and ask the user before building anything else

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

## 6. Finish

- [ ] 6.1 Run `ruff`, `mypy` and `pytest`, and `npm run lint` and `npm run build`
- [ ] 6.2 Open the PR naming `market-price-data`
- [ ] 6.3 After the PR merges and the first ingest has run, archive this change and tick task 4.2a in `prototype-adoption-roadmap/tasks.md`
