# Tasks

## 1. Backend

- [x] 1.1 Add `category` and nullable `farmer_id` to `CropCatalog`, and migration `0010`: add the columns, replace the unique name constraint with the two partial unique indexes, insert the predefined crops with their group and feed commodity, rename Corn to Maize and Soybeans to Soybean, and tidy earlier typed names (one-farmer names become that farmer's, unused names are deleted)
- [x] 1.2 Move the seed list to one backend module used by the admin reference-seed endpoint, and keep the migration's own copy in step
- [x] 1.3 Make `GET /api/v1/reference/crops` return the predefined crops plus the caller's own, with `id`, `name`, `category` and `custom`; make `POST` create or return per the spec (predefined first, then the caller's own, trimmed, 100 characters)
- [x] 1.4 Add pytest cases: the list for a new farmer, privacy between two farmers, same custom name for two farmers, a name matching a predefined crop in other case, blank and too-long names
- [x] 1.5 Regenerate `openapi.json` and the TypeScript types (`npm run generate:contracts`)

## 2. Frontend

- [x] 2.1 Build `CropPickerComponent`: grouped list, search over the shown and English names, "Add new crop" row, keyboard and ARIA behaviour, with a spec
- [x] 2.2 Use it in Add crop in place of the combobox, feed it the farmer's catalog list, and keep the form control holding the crop name
- [x] 2.3 Update `ReferenceDataService` to read the per-farmer list and to look up names case-insensitively
- [x] 2.4 Add `crop.<slug>` names for every predefined crop and the group names to `en`, `hi` and `mr`, and pass `scripts/check-translations.mjs`
- [x] 2.5 Update the Add crop spec for the scenarios: pick from the list, search in either language, add a missing crop

## 3. Finish

- [ ] 3.1 Run `ruff`, `mypy` and `pytest`, and `npm run lint` and `npm run build`
- [ ] 3.2 Have the user review the Marathi and Hindi crop names, and take a Neon snapshot before the deploy
- [x] 3.3 Open the PR naming `crop-catalog`
- [ ] 3.4 After the PR merges, archive this change (it adds `crop-catalog` and updates `crops-screen`)
