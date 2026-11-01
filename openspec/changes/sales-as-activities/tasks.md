# Tasks

One PR on `claude/feature-sales-as-activities`. Backend checks: `ruff`, `mypy`, `pytest`. After any router or schema change run `python scripts/export_openapi.py` (from `projects/backend/`) then `npm run generate:contracts`. UX source: `design/prototype/myfarm-prototype.html` (approved and committed on this branch).

## 1. Backend: sale columns, validation, data move

- [ ] 1.1 Add migration `0012_sale_activity_columns`: five nullable sale columns on `activity`, then copy live `crop_sale` rows (joined to `crop`) into Completed Sale activities with the month-based season; downgrade removes the copied activities and the columns; `crop_sale` stays. Verify: a migration test with two live sales and one soft-deleted sale shows exactly two Sale activities with identical date, crop, figures and notes, and upgrade then downgrade leaves `crop_sale` untouched.
- [ ] 1.2 Add the five fields to the `Activity` model and to `ActivityCreate`, `ActivityUpdate` and `ActivityRead`. Verify: schema tests accept and return the fields and keep them optional.
- [ ] 1.3 Enforce the Sale rules in the activities router on create and update: figures only on type Sale; Completed Sale needs a crop and positive quantity, unit, rate and amount; non-Completed figures validated if present; changing away from Sale clears the columns. Verify: endpoint tests for each 422 case, a planned Sale saved without figures, Scheduled to Completed update with and without figures, and type change clearing figures.
- [ ] 1.4 Confirm tenancy and filters: another farmer's Sale activity returns 404, and `GET /activities?activity_type_id=<Sale>&crop_id=<id>` returns only that crop's sales. Verify: endpoint tests with two farmers.
- [ ] 1.5 Remove the `/crops/{id}/sales` routes, `schemas/crop_sale.py`, the `CropSale` route imports and `tests/test_endpoints_crop_sales.py`; regenerate `openapi.json` and frontend contracts. Verify: `/crops/{id}/sales` returns 404, the "contracts up to date" CI check passes, and `ruff`, `mypy`, `pytest` are green.

## 2. Frontend: activity form, page and list

- [x] 2.1 Extend the activity models, mapper and `ActivityService` with the five sale fields. Verify: mapper specs round-trip the fields and omit them for other types.
- [x] 2.2 Add the Sale details block to the Log/Edit activity form per the prototype: revealed by the Sale chip, "Crop sold" required, required-or-optional text and markers following the status, amount calculated from quantity and rate and overridable, error messages from the spec, figures dropped when the type changes. Verify: component specs for reveal, planned sale saved without figures, completed sale errors, calculated and overridden amount, and type switch.
- [x] 2.3 Accept `type=Sale` and `cropId` from the "Record sale" link and return to the crop page after saving and on Cancel. Verify: spec that Record sale opens the form with type and crop set and that save and Cancel return to the crop page.
- [x] 2.4 Show the Sale card on the activity page and the quantity, rate, buyer and `+amount` on the list row; make "Mark done" on a Sale without figures open the edit form with Completed selected. Verify: specs for completed and planned sale pages, the list row, and Mark done with and without figures.

## 3. Frontend: crop Sales card and clean-up

- [x] 3.1 Rebuild the crop Sales card from the crop's Sale activities (Cancelled excluded): completed rows with amount, "Planned sale" rows with status badge, rows open the activity page, totals, profit and profit per acre from Completed sales only. Verify: card specs for no sales, profit, loss, planned-only, mixed, and row navigation.
- [x] 3.2 Delete `crop-sales.service.ts`, `sale-form.component.*`, the `sales/new` and `sales/:saleId/edit` routes, their contracts and the `shell.title.recordSale` and `shell.title.editSale` strings; add en and mr strings for the Sale details block, "Planned sale" and the new messages. Verify: `npm run build` passes with no references left (`grep` for `CropSalesService` and `sale-form` is empty) and the translation completeness check passes.

## 4. Roadmap, PR and archive

- [ ] 4.1 Update the Playwright golden path if it records a sale; run `npm run lint`, `npm run build`, `npm test` and the backend `ruff`, `mypy`, `pytest`. Verify: all green locally.
- [x] 4.2 Add `sales-as-activities` to the roadmap before 4.6 (note that 4.6 reads sales from activities) in `openspec/changes/prototype-adoption-roadmap/tasks.md`. Verify: the new line is present above `reports-redesign`.
- [ ] 4.3 Open the draft PR (it already holds the prototype and plan). Verify: PR links this change; CI runs.
- [ ] 4.4 Once CI is green, archive the change on this branch (sync `crop-sales` and `activity-log-and-detail` specs, tick the roadmap line) and mark the PR ready. Verify: `openspec/specs/crop-sales/spec.md` shows the new requirements and the change sits under `archive/`.
- [ ] 4.5 After merge, verify production counts and total amount match between live `crop_sale` rows and Sale activities, then note the follow-up change that drops `crop_sale`. Verify: figures recorded in the PR.
