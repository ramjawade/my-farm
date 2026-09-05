# DB Schema Plan: Common Postgres + Firestore Schema

## Context

A Claude Design session produced `MyFarm Database Design.dc.html` (handed
off separately), a 4-layer ER diagram (L0 domain contexts → L1 conceptual
ER → L2 logical/Postgres schema → L3 Firestore physical layout) derived
from this app's real TypeScript models and `PHASE_5_PLAN.md`.

The app's actual backend decision (`PHASE_5_PLAN.md`) is Firebase Auth +
Firestore — there is no Postgres anywhere in this repo today, and none is
planned. The ask is to future-proof the schema for Postgres while the app
runs on Firebase now, from **one common schema definition** so the two
representations can't drift apart. This is a documentation/schema
deliverable, not app wiring — no Angular code, DI providers, or services
change.

Every field was re-verified against the real source (not just the design
doc's summary): a full read of `activity.models.ts`,
`farmer-registration.models.ts`, `crop-timeline.models.ts`, `map.models.ts`,
`weather.models.ts`, `backup.models.ts`, and `storage.interface.ts`, plus a
grep of every `localStorage` key actually written by `LocalStorageService`,
`auth.service.ts`, `migration.ts`, and the onboarding/workflow services.
Two corrections vs. the design doc's assumptions:
- `userRole` is `string` (unconstrained) — confirmed, matches design.
- Real per-user localStorage keys are `my_farm_${userId}_activities`,
  `my_farm_${userId}_activity_expenses`, `my_farm_${userId}_crops`,
  `my_farm_${userId}_saved_farms`, `my_farm_${userId}_weather_history`, plus
  legacy pre-migration keys (`my_farm_crop_timeline_activities`,
  `my_farm_farm_activities_old`, `my_farm_activities_old`,
  `my_farm_activity_expenses_old`) already handled by
  `features/activity/migration.ts`. The design doc's migration map used
  simplified/slightly-off key names — this plan's migration map uses the
  real ones.

There's also a pre-existing, simpler `.diagram/er.md` (Mermaid ER, no
weather forecast/alert breakdown, no RBAC, and an inaccurate 1:1
Land–Weather relationship — weather is actually keyed by user+location, not
by land). That file is left untouched; the new `db/` docs supersede it as
the detailed, verified version, with a pointer added from `db/README.md`.

## Approach

One canonical schema source, two generated representations, under a new
top-level `db/` directory:

```
db/
  README.md                 — overview: one schema, two backends, what's proposed vs real
  schema.ts                 — canonical entity/field definitions (source of truth)
  migrations/
    0001_init.sql            — farmer, land, land_point, crop, activity,
                                activity_expense, activity_attachment,
                                weather_snapshot, weather_forecast_day, weather_alert
    0002_rbac.sql             — role, farmer_role, module, role_module (proposed, commented as not yet wired)
  firestore/
    structure.md              — collection/subcollection layout (L3), matches schema.ts field-for-field
    firestore.rules           — security rule shape (per-farmer subtree)
    firestore.indexes.json    — the 6 composite indexes from the design's L3 section
  MIGRATION_MAP.md            — real localStorage key → Firestore path, using verified key names
```

### `db/schema.ts` — the common schema
Plain TS objects (no runtime framework, never imported by the app) — one
entry per entity with `{ name, source: '<real file>#<Interface>', fields: [{
name, tsType, sqlType, nullable, pk, fk, unique, arrayOf }] }`. Both the SQL
and the Firestore doc are generated from this one source by hand, so field
lists in both must trace back to it and match exactly. Entities: `farmer`
(from `FarmerRegistrationData`), `land` (`SavedFarm`) + `land_point`
(`LatLngPoint[]`), `crop` (`CropEntity`), `activity` (`Activity`, with
`metadata` kept as an open jsonb bag — matches the design's rationale:
irrigation/spray/harvest need different fields and the set keeps growing),
`activity_expense`, `activity_attachment` (new — formalizes the base64
`attachments[]` array as out-of-row storage, per the design's
1MB-Firestore-doc-limit rationale), `weather_snapshot` +
`weather_forecast_day` + `weather_alert` (from `WeatherData` /
`CurrentWeather` / `ForecastDay` / `WeatherAlert`). Plus the **proposed**
RBAC entities (`role`, `farmer_role`, `module`, `role_module`) clearly
flagged `proposed: true` since `userRole` today is unconstrained free text
that nothing reads.

### `db/migrations/*.sql`
Real Postgres DDL (types, PK/FK/UNIQUE constraints, `CHECK` for enum-shaped
columns since plain Postgres enums are painful to alter) matching L2 of the
design, corrected against the verified model fields above. Proposed RBAC is
its own migration file so it's obviously optional/separable.

### `db/firestore/*`
Matches L3 of the design: `farmers/{uid}` root doc with `lands`, `crops`,
`activities` (+ `expenses`, `attachments` subcollections), `weather`
subcollections, and global read-only `roles`/`modules`/`role_modules` — the
layout that's actually real for this codebase per `PHASE_5_PLAN.md` §3.
`firestore.indexes.json` in real Firestore index-config JSON shape (not
prose) so it's usable as-is if/when Phase 5 lands. `firestore.rules` gives
the per-farmer subtree rule shape from the design, plus a read-only rule for
the global `roles`/`modules` collections.

### `db/MIGRATION_MAP.md`
Table of real localStorage key → Firestore path → note, using the verified
key list (including the legacy pre-migration keys), superseding the design
doc's approximated version.

## Out of scope
No Angular source changes, no new dependencies, no wiring into
`IStorageService`/`app.config.ts`. This is a reference/documentation
deliverable, extended to produce matching Firestore artifacts from the same
source so neither representation drifts from the other.

## Verification
This is a docs/schema deliverable with no runtime code path, so there's no
`ng build`/`ng test` to run against it. Verification is:
- Cross-checking every column in `migrations/*.sql` and every field in
  `firestore/structure.md` against `db/schema.ts` (same source, so they
  can't disagree) and against the real model files (so they can't disagree
  with the app).
- Confirming `firestore.indexes.json` is valid JSON matching Firestore's
  real index-config schema.
- Manual review of the SQL for Postgres syntax validity (no Postgres
  instance available in this environment to run it against).
