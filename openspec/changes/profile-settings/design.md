## Context

Profile today is `features/profile/profile.component` (three cards) plus an 800-line `profile-edit-dialog` that edits five sections and saves account fields to `/me` and farm fields to the default farm (see `farm-profile-persistence`). The prototype (`design/prototype/myfarm-prototype.html`, `profile()`) uses `PGRP` row groups, `S.pe` single-field edit state, `pfErr` validation and a `PREQ` missing-details list. Water source, irrigation type and farming method currently live on `farm`; `farm_crop` holds primary crops.

## Goals / Non-Goals

**Goals:** match the prototype Profile; one dialog per field; move the three fields to land and crop in the database and API; keep every existing farmer's data.

**Non-Goals:** UI for the moved fields (Lands and Crops changes), dropping the old columns and `farm_crop`, profile KPIs, GPS capture.

## Decisions

1. **Rewrite, not patch.** The old dialog's sections, map picker and crop chips are deleted. A new small `ProfileFieldDialogComponent` takes a field key and renders the right control (text, email, role select, language select, theme select). Field metadata is one array of groups in `profile.fields.ts`, mirroring `PGRP`, so rows, validation and dialog share it.
2. **Dialog presentation with Bootstrap.** Use Bootstrap modal classes with `modal-dialog-centered` on `md` and up; below `md` a bottom-aligned sheet using utilities (`align-items-end`, full width, rounded top). Custom CSS only if utilities fall short.
3. **Where each field saves.** Name, email, role and language go to `/me` as now. Village, pincode, district and state go to the default farm update (create on first save) through the existing `farmer-profile-api.service`. Theme stays in `ThemeService` (device). "District and state" is one row; its dialog has two inputs and saves both.
4. **Validation** copies the prototype: name required, email shaped like an address when present, pincode exactly 6 digits when present. Email, village, district and pincode count as "missing" for the banner (state is bundled with district).
5. **Migration `0007`.** Add nullable `land.water_source`, `crop.irrigation_type`, `crop.farming_method`. Copy with Postgres `UPDATE ... FROM`: lands from their farm, crops from the farm of their land. Downgrade drops the three columns. The old `farm` columns and `farm_crop` stay (the roadmap drops them one PR later), so rolling the app back is safe.
6. **API shape.** Add the fields to land and crop create, update and read schemas as optional strings (same type as the farm fields today). Regenerate `openapi.json` and the TypeScript contracts.
7. **Translation.** New row labels, help text and error strings go in mr, hi and en; the translation completeness check from `marathi-language-switching` must stay green.
8. **Removed UI.** Delete buttons, the "profile complete" badge, farm name/area and primary crop chips are removed. Home and weather keep working because the `/me` and farm reads are unchanged in this PR.

## Risks / Trade-offs

- Farmers cannot set water source, irrigation or method until the Lands and Crops redesigns land → keep those close behind this change; existing values are preserved by the migration.
- A farm with no lands or crops copies nothing; its values remain on `farm`.
- The rewrite drops the map pin picker for farm location → location is now text fields; map-based land drawing is unaffected.
- Old and new columns hold the same data for one PR → removed by the cleanup PR.

## Migration Plan

Deploy backend (migration runs on start), then frontend. Rollback: reverting the frontend is safe because the old columns are intact; `alembic downgrade` drops the new columns.

## Open Questions

- The roadmap line mentions "profile KPIs and GPS", which the prototype Profile does not show. Assumed out of scope; confirm before apply.
