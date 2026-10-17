# Tasks

## 1. Backend

- [x] 1.1 Add the `CropSale` model and Alembic migration `0008` for `crop_sale` with an index on `crop_id`
- [x] 1.2 Add Pydantic schemas, repository and the `crops/{crop_id}/sales` router (list, create, update, soft delete), resolving the crop through the tenant-scoped repository
- [x] 1.3 Add pytest cases: CRUD, validation (quantity, rate, amount above zero) and a cross-tenant 404 on every endpoint
- [x] 1.4 Regenerate `openapi.json` and the generated TypeScript types (`npm run generate:contracts`)

## 2. Frontend data

- [x] 2.1 Add the sale model and a `CropSalesService` (list, add, update, remove) over the HTTP service
- [x] 2.2 Add the pure `sales-summary` helper (total, profit, profit per acre) with a spec

## 3. Frontend screens

- [x] 3.1 Build the Record/Edit sale page and route with the validation messages, calculated amount and unit suggestions, following `angular-best-practices`
- [x] 3.2 Add the Sales card to the crop detail: empty state, three figures, rows, Edit and Delete with confirm, with "Record sale" on the card itself at every width
- [x] 3.3 Add i18n keys for mr, hi and en and pass `scripts/check-translations.mjs`
- [x] 3.4 Update or add component specs for the form and the card

## 4. Finish

- [ ] 4.1 Run `npm run lint` and `npm run build`; backend `ruff`, `mypy`, `pytest`
- [x] 4.2 Open the PR naming `harvest-and-sale-tracking`
- [ ] 4.3 After the PR merges, archive this change and tick task 4.1 in `prototype-adoption-roadmap/tasks.md`
