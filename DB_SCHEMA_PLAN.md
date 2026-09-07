# DB Schema Plan: One Model, Firebase Now, Postgres Later

## Context

MyFarm's data lives in `localStorage` today. `PHASE_5_PLAN.md` commits the
app to **Firebase (Auth + Firestore)** as its backend. The requirement here
is that the schema we adopt for Firestore must not become a cage: it has to
be **scalable**, work on **Firestore now**, and be **portable to a
relational (Postgres) database later** without a data rewrite or an
application rewrite.

That is not automatic. A Firestore schema designed casually — parent ids
implied by document paths, `Timestamp` objects, `GeoPoint`s, unbounded
nested arrays, denormalized copies treated as truth — cannot be loaded into
Postgres without a lossy, hand-written transform per collection. The whole
point of this plan is a **portability contract** that makes the eventual
migration a mechanical export-and-load instead of a project.

This plan supersedes the earlier "reference docs only" framing.

## Verified ground truth

Every claim below was checked against the real source, not the design
diagram. Three findings change the schema:

| # | Finding | Consequence |
|---|---|---|
| 1 | **Five different ID formats are in use.** `farmer` = `'f-'+rand36+'-'+time36` (`farmer-registration.service.ts:78`); `crop` = `'c-'+rand36+'-'+time36` (`crop-timeline.service.ts:124`); `land` = `crypto.randomUUID()` (`farm-draw.service.ts:120`); `activity` = `` `activity_${now}_${rand9}` `` and `expense` = `` `expense_${now}_${rand9}` `` (`activity.service.ts:118,179`) | **No ID column may be typed `uuid`.** Only lands would pass. All PK/FK columns are `varchar(64)`. Phase 5 additionally makes `farmer.id` the Firebase Auth uid (a 28-char string, also not a UUID). |
| 2 | `Activity.date` is `date?: number` — *"undefined = not yet scheduled"* | `activity.date` must be **nullable**. A `NOT NULL` column would reject every unscheduled activity. |
| 3 | The design doc claims `crop.fieldId` is a display string (`"Field A"`). **It is not.** No such seed exists anywhere in the source, and `ActivityService.resolveFieldId` derives `fieldId` from the crop's land so *"an activity can never point at a land that disagrees with its crop"* (`activity.models.ts:26-28`). | `crop.land_id` / `activity.land_id` are safe to model as real FKs. Migration still validates them (nothing enforces referential integrity today). |

Also confirmed: `FarmerRegistrationData.userRole` is an unconstrained
`string` that nothing reads; all model timestamps are `number` (epoch
millis), not `Date`; the real per-user localStorage keys are
`my_farm_${userId}_{activities,activity_expenses,crops,saved_farms,weather_history}`
plus the global `my_farm_registered_farmers`, with legacy pre-migration keys
already handled by `features/activity/migration.ts`.

## The portability contract

These nine rules are the foolproof part. Every one of them exists to
prevent a specific, known way that Firestore data fails to load into
Postgres. They are cheap now and non-negotiable later.

1. **Every document stores its own `id` as a field**, duplicating the
   document key. A Firestore export contains document *bodies*; the key is
   not inside them. Without this, an export has no primary key.
2. **Every document stores all foreign keys explicitly**, even when the
   path already implies them — every doc under `farmers/{uid}/...` carries
   `farmerId`. This is the single highest-value rule: it is what turns a
   nested export into flat, loadable tables. Without it the tenant key is
   destroyed by the export.
3. **Timestamps are epoch-millis `number`.** Never Firestore `Timestamp`,
   never a `serverTimestamp()` sentinel in a stored field. The app already
   does this. Postgres loads them as `timestamptz` via
   `to_timestamp(ms/1000.0)`.
4. **IDs are opaque strings, typed `varchar(64)` everywhere** (finding #1).
   New writes should use `crypto.randomUUID()` so the estate converges on
   one format, but the column type never assumes it.
5. **No Firestore-only types in stored data.** No `GeoPoint` (use
   `{lat, lng}` numbers — the app already does), no `DocumentReference` (use
   the plain id string).
6. **Arrays only for small, bounded, atomically-read value lists.**
   `primaryCrops[]` and polygon `points[]` qualify. Anything that can grow
   unbounded or needs its own query is a subcollection, because a
   subcollection maps to a child table and an array does not.
7. **Maximum two levels of subcollection** under the farmer document.
   Deeper nesting stops mapping cleanly to tables and complicates rules.
8. **No denormalized copy of mutable data is ever the source of truth.**
   Derived/cached fields must be marked as such and must be recomputable;
   they are dropped at migration, not carried.
9. **Every document carries `schemaVersion: number`**, so migrations can be
   incremental, detectable, and resumable.

## Scalability constraints designed for

| Limit | Design response |
|---|---|
| Firestore 1 MB document cap | Base64 `attachments[]` never stored inline — they become Storage paths in an `attachments` subcollection. `metadata{}` stays a bounded per-activity bag. |
| Sustained ~1 write/sec per document | No counters or rollup totals on the farmer document. Expense totals are computed client-side from the already-loaded subcollection. |
| Unbounded cache growth | Weather is a write-through cache on a 30-min TTL with a **90-day rolling window per farmer**; it is disposable and explicitly *not* migrated. |
| Query cost | Composite indexes driven by the activity list's real filters/sorts, not speculation. Pagination via `orderBy(date desc) + startAfter(cursor)` — never `offset`. |
| Cross-farmer analytics (future) | Requires collection-group indexes; noted as a known future cost of nesting, accepted because per-farmer reads dominate today. |

## Deliverables

```
db/
  README.md                  — how the three layers relate; the contract above
  schema.ts                  — canonical entity/field definitions (SOURCE OF TRUTH)
  firestore/
    structure.md              — collection layout, field-for-field from schema.ts
    firestore.rules           — per-farmer subtree isolation + global read-only refs
    firestore.indexes.json    — real Firestore index-config JSON, deployable as-is
  postgres/
    0001_init.sql             — core tables (varchar ids, nullable activity.date)
    0002_rbac.sql             — proposed role/module tables, separable
  MIGRATION_LOCAL_TO_FIRESTORE.md  — localStorage → Firestore, real key names
  MIGRATION_FIRESTORE_TO_POSTGRES.md — the export→load procedure below
```

`db/schema.ts` is plain TypeScript data (no framework, not imported by the
app) listing each entity, its `source` pointer to the real model file, and
each field's type/nullability/PK/FK. **Both** the Firestore doc and the SQL
are written from it, so a field can never exist in one and not the other.

### Entities

`farmer` · `farmer_crop` · `land` · `land_point` · `crop` · `activity` ·
`activity_expense` · `activity_attachment` · `weather_snapshot` ·
`weather_forecast_day` · `weather_alert`, plus **proposed** RBAC (`role`,
`farmer_role`, `module`, `role_module`) kept in a separate migration because
`userRole` is free text nothing reads today.

## Firestore → Postgres migration procedure

This is the payoff, and it is deliberately boring:

1. `gcloud firestore export` → newline-delimited JSON per collection.
2. Flatten: because of contract rules #1 and #2, each document already
   carries its own `id` and every parent key, so "flatten" is a rename of
   camelCase fields to snake_case. **No path parsing, no key reconstruction.**
3. Load in FK dependency order: `farmer` → `farmer_crop` → `land` →
   `land_point` → `crop` → `activity` → `activity_expense` /
   `activity_attachment`. Weather is *not* migrated — it refetches.
4. Convert epoch millis → `timestamptz` (`to_timestamp(ms/1000.0)`) and
   inline arrays → child table rows (`points[]` → `land_point`,
   `primaryCrops[]` → `farmer_crop`).
5. **Reconcile referential integrity**, which Firestore never enforced:
   `crop.land_id` and `activity.land_id`/`crop_id` values that don't resolve
   are set `NULL` and written to a rejects log rather than failing the load.
6. Verify: per-table row count equals per-collection document count, and the
   set of ids matches. Any mismatch fails the migration.

## Staging (trim during review)

- **Stage A — schema + contract.** `db/schema.ts`, both SQL files, the
  Firestore structure/rules/indexes, both migration docs. No app changes.
- **Stage B — shared types.** A generated `src/app/core/data/schema-types.ts`
  the app actually imports, so models and schema cannot drift. Small, but it
  touches app code.
- **Stage C — Phase 5 implementation.** `FirestoreStorageService` behind the
  existing `IStorageService`, written against the contract. This is Phase 5's
  job, not this plan's; listed so the boundary is explicit.

**Recommendation: approve Stage A now**, decide B/C separately. Stage A is
what makes the Firestore work start correct, and it changes no runtime code.

## Risks

| Risk | Mitigation |
|---|---|
| Contract rule #2 is skipped during Phase 5 implementation because the parent id "is already in the path" | Rule is stated in `db/README.md` and enforced in `firestore.rules` (a write whose `farmerId` field ≠ its path uid is rejected) — so the database itself refuses undermigratable documents |
| Schema and TS models drift as features land | Stage B makes the app import generated types; until then, `schema.ts` carries a `source` pointer per entity for review |
| Existing heterogeneous IDs (finding #1) leak into a `uuid` assumption later | Every ID column is `varchar(64)`; documented in both SQL and `structure.md` |
| Migration silently drops rows with unresolvable FKs | Step 5 logs rejects and step 6 fails the run on any count mismatch |

## Verification

Documentation/schema only in Stage A — there is no runtime path, so no
`ng build`/`ng test` applies to it. Verification is:

- Every column in `postgres/*.sql` and every field in `firestore/structure.md`
  matches `db/schema.ts`, and `schema.ts` matches the real model files.
- `firestore.indexes.json` is valid JSON against Firestore's index-config
  schema.
- `firestore.rules` compiles and its per-farmer isolation plus the rule-#2
  `farmerId`-matches-path check are exercised by the Firebase rules emulator.
- SQL reviewed for Postgres syntax validity (no Postgres instance available
  in this environment to execute it).
