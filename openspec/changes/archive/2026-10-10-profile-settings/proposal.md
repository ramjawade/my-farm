## Why

The Profile screen is still the old three-card page with a large multi-section edit dialog and per-section Delete buttons. The prototype replaces it with a short settings list that edits one field at a time. The same prototype moves farming details to where they belong: water source describes a land, and irrigation and farming method describe a crop, not the whole farm. Profile ships first in the roadmap because those moves touch the Lands and Crops screens that follow.

## What Changes

- Replace the Profile page with the prototype layout: back link to Home, avatar header (name, phone, role, member since), a "details left" banner for missing fields, and grouped setting rows (Account, Location, App) with Sign out below.
- Replace the multi-section edit dialog with a single-field edit dialog: centred on desktop, bottom sheet on the phone. Phone is a read-only row.
- Rows: Full name, Phone (read-only), Email, Role; Village, District and state, Pincode; Language, Theme.
- Remove the farm name, farm area, primary crops, water source, irrigation and farming method fields from Profile, and remove the section Delete buttons and the "profile complete" badge.
- Backend: add `water_source` to `land`, and `irrigation_type` and `farming_method` to `crop`; copy each farm's existing values onto its lands and crops in the migration. The old `farm` columns stay for now and are dropped in a later PR.
- Stop reading and writing primary crops from the Profile. The `farm_crop` table and API field stay until the same cleanup PR.
- Out of scope: showing or editing the new land and crop fields in the UI (done in `lands-redesign` and `crops-redesign`).
- Out of scope: profile KPI tiles and GPS capture. The prototype's Profile has neither, so these two words in the roadmap line are left for a later change if still wanted.

## Capabilities

### New Capabilities
- `farmer-profile`: the Profile settings list, the single-field edit dialog, the missing-details banner and the fields it covers.

### Modified Capabilities
- `farm-profile-persistence`: the profile now saves location fields only to the default farm; water source, irrigation, farming method and primary crops are no longer written by Profile, and land and crop gain the moved fields.

## Impact

- Frontend: `features/profile/` (page and dialog rewritten), i18n keys for mr/hi/en, profile specs, e2e `profile-persistence.spec.ts`.
- Backend: `models.py`, `schemas/land.py`, `schemas/crop.py`, new migration `0007`, `openapi.json` and generated contracts, pytest.
- Data: one migration that copies farm-level values down to lands and crops. Reversible by dropping the new columns.
