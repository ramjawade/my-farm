## 1. Backend

- [x] 1.1 Add `land.water_source`, `crop.irrigation_type`, `crop.farming_method` to `models.py` and the land and crop schemas (create, update, read)
- [x] 1.2 Write migration `0007` that adds the columns and copies the farm values down to lands and crops; downgrade drops them
- [x] 1.3 Pytest: set and read the new fields; migration copy for a farm with two lands and three crops; a farm with none is untouched
- [x] 1.4 Regenerate `openapi.json` and the frontend contracts; run `ruff`, `mypy`, `pytest`

## 2. Profile screen

- [x] 2.1 Add `profile.fields.ts` (groups, labels, help keys, validators) mirroring the prototype's `PGRP`, `PREQ` and `pfErr`
- [x] 2.2 Rewrite `profile.component` to the prototype layout: back link, avatar header, missing-details banner, grouped rows with "Add" placeholders, Sign out
- [x] 2.3 Add `ProfileFieldDialogComponent` (centred on `md` and up, bottom sheet below); stop using the old multi-section dialog on Profile (Home and Weather still embed it until their redesigns); drop Delete buttons, complete badge, farm name/area and primary crop controls from Profile
- [x] 2.4 Save paths: name, email, role, language to `/me`; village, district, state, pincode to the default farm; theme to `ThemeService`; keep the saving, error and double-submit behaviour
- [x] 2.5 Add mr, hi and en strings; keep the translation completeness check green

## 3. Tests and wrap-up

- [x] 3.1 Unit specs: rows and "Add" placeholders, banner count and Add action, each validator, save failure keeps the value, phone read-only, language switch
- [x] 3.2 Update `e2e/profile-persistence.spec.ts` for the row and dialog flow
- [x] 3.3 Run `npm run lint`, `npm run build`, `npm test`; fix findings
- [x] 3.4 Open the PR naming `profile-settings`
- [x] 3.5 After the PR merges, archive this change and tick task 2.2 in `prototype-adoption-roadmap/tasks.md`
