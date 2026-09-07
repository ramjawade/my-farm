# Backend & Data Plan: One Model, Firebase Now, Postgres Later

Consolidates the backend and database design into a single document:
technology stack, identifier strategy, normalised schema, Firestore layout,
the portability contract, and the implementation stages.

- **Supersedes** `DB_SCHEMA_PLAN.md` (renamed to this file).
- **Extends** `PHASE_5_PLAN.md`, which decided the backend but said nothing
  about identifiers, normalisation, or relational portability. Where this
  document is more specific, it wins; nothing here contradicts that plan's
  Firebase decision.

---

## 1. Stack

Verified from `package.json`, `app.config.ts`, and `.github/workflows/`.

| Layer | Choice | Status |
|---|---|---|
| Frontend | **Angular 20.3** — standalone components, **signals**, **zoneless** change detection (`provideZonelessChangeDetection`) | In use |
| Language | **TypeScript 5.9** | In use |
| UI | Bootstrap 5.3 + bootstrap-icons; **Chart.js 4.5** and **D3 7.9** (charts); **Leaflet 1.9** (field drawing) | In use |
| Async | RxJS 7.8 | In use |
| Offline | `@angular/service-worker` PWA, already registered in `app.config.ts` | In use |
| Persistence (today) | `localStorage` behind `IStorageService` | In use |
| **Auth (target)** | **Firebase Auth** — phone OTP (`signInWithPhoneNumber`); PIN demoted to a local device re-lock | Not started |
| **Database (target)** | **Cloud Firestore** + offline persistence | Not started |
| **Files (target)** | **Firebase Cloud Storage** — activity photos | Not started |
| **Secrets (target)** | **Cloud Functions** — weather proxy holding the OpenWeatherMap key | Not started |
| **Database (later)** | **PostgreSQL**, reached through the same DI seam | Future |
| Hosting / CI | GitHub Actions (Node 24: lint → format:check → test → build) → GitHub Pages | In use |
| Tests | Karma + Jasmine (29 specs), ESLint 10, Prettier | In use |

No Firebase package is installed yet — Phase 5 has not begun. The SDK choice
is the modular `firebase` JS SDK over `@angular/fire`, per `PHASE_5_PLAN.md`
(smaller bundle, matches the project's lean-dependency style).

### The swap seam

`app.config.ts` already binds persistence by DI:

```ts
{ provide: IStorageService, useClass: LocalStorageService }     // today
{ provide: IStorageService, useClass: FirestoreStorageService } // Phase 5
{ provide: IStorageService, useClass: ApiStorageService }       // Postgres era
```

`IStorageService` (`core/storage/storage.interface.ts`) is fully async
already, so a remote implementation fits the existing contract. **Every
backend change in this plan happens behind that seam.** Components are not
touched.

Caveat carried from `PHASE_5_PLAN.md`: only `activity.service.ts` uses the
seam today. `farmer-registration.service.ts`, `crop-timeline.service.ts`,
`auth.service.ts`, and `farm-draw.service.ts` still hit `localStorage`
directly and must be moved onto it, or "swap the backend" is true for one
feature only.

---

## 2. Identifier strategy — **UUIDv7 everywhere**

**Decision: every entity uses a client-generated UUIDv7 primary key, stored
as Postgres `uuid` and as the Firestore document key.**

### Why not numeric auto-increment

Numeric IDs are the natural relational choice, and they are not viable here:

- **Firestore has no sequences.** Emulating one needs a central counter
  document, which caps at roughly **1 sustained write/second** — the exact
  ceiling the highest-write-volume table (`activity`) would hit first.
- **They break offline.** The app is an offline-first PWA and Phase 5 enables
  Firestore offline persistence for rural connectivity. A record created
  offline cannot be assigned a sequential ID until it syncs, so it has no
  stable identity to reference in the meantime.
- They also leak record counts and invite enumeration.

### Why UUIDv7 rather than UUIDv4

UUIDv7 (RFC 9562) puts a 48-bit Unix-millisecond timestamp in the high bits,
so it keeps every UUIDv4 property while adding time ordering:

| Property | v4 | **v7** |
|---|---|---|
| Generated client-side, works offline | ✅ | ✅ |
| Collision-free without coordination | ✅ | ✅ |
| Postgres native `uuid`, 16 bytes | ✅ | ✅ |
| **Sequential B-tree inserts** (no random page splits on `activity`) | ❌ | ✅ |
| **Chronological sort by key** — Firestore orders documents lexicographically, so `orderBy(__name__)` gives free chronological ordering | ❌ | ✅ |

Cost is a ~15-line generator (`crypto.randomUUID()` only emits v4) in
`core/data/uuid.ts`, unit-tested for monotonicity and format.

If a human-facing short reference is ever needed, Postgres adds a
`display_no bigint GENERATED ALWAYS AS IDENTITY` column — a numeric label,
never the key.

### The one exception, handled explicitly

`farmer.id` cannot be the Firebase Auth uid, because that is a 28-character
string owned by the auth provider. Instead:

- `farmer.id` — **UUIDv7**, like every other table. Internal identity.
- `farmer.auth_uid varchar(128) UNIQUE` — the Firebase Auth uid.

This keeps the internal ID format 100% consistent and decouples the data
model from the auth provider. Firestore still keys the farmer document by
`auth_uid` (`farmers/{uid}`) because that makes the security rule a single
zero-read clause; the document body carries both `id` and `authUid`.

### Normalising the existing IDs

Five incompatible formats are in use today and all must converge:

| Entity | Current generator | Source |
|---|---|---|
| `farmer` | `'f-' + rand36 + '-' + time36` | `farmer-registration.service.ts:78` |
| `crop` | `'c-' + rand36 + '-' + time36` | `crop-timeline.service.ts:124` |
| `land` | `crypto.randomUUID()` (v4) | `farm-draw.service.ts:120` |
| `activity` | `` `activity_${now}_${rand9}` `` | `activity.service.ts:118` |
| `activity_expense` | `` `expense_${now}_${rand9}` `` | `activity.service.ts:179` |

The localStorage→Firestore migration mints a **new UUIDv7 per record, seeded
from that record's real `createdAt`**, so historical ordering is preserved.
It builds an **old-id → new-id remap table first**, then rewrites every
reference (`fieldId`, `cropId`, `activityId`, `parentActivityId`) through it.
Migration fails if any reference is unresolved — never silently dropped.

---

## 3. Normalised schema (3NF)

### Normalisation decisions

| Change | Reason |
|---|---|
| **Split `farmer` into `farmer` + `farm`** | Farm attributes (`farmName`, `farmArea`, `waterSource`, `irrigationType`, `farmingMethod`, location) describe a *farm*, not a person. Currently flattened into the registration record. Also unblocks multi-farm accounts. |
| **Add `crop_catalog` lookup** | `primaryCrops[]`, `crop.name`, and `crop.cropType` are repeated free text. A reference table removes the repeating group and makes crop names consistent. |
| **Add `expense_category` lookup** | `activity_expense.category` is free text ('Labour', 'Seeds', 'Machine Rent'). |
| **Add `activity_type` lookup** | 12 values plus a `Custom` escape hatch — data, not a state machine, so a table beats a `CHECK`. |
| **Drop `land.geo_json`** | Fully redundant with `land_point` rows. Regenerated on read. |
| **`land.area_hectares` / `area_acres` → `GENERATED ALWAYS AS … STORED`** | Transitive dependency on `area_sq_m`. Generated columns keep read speed without the 3NF violation. |
| **Drop `crop.upcoming_activity`** | Derived — it is the crop's next scheduled activity. Computed by the service layer. |
| **Expand `weather_snapshot.current` into columns** | `CurrentWeather` has a fixed shape; a JSON blob hides it from the type system for no benefit. |
| **Keep `activity.metadata` as `jsonb`** | Deliberate exception. Irrigation, spray, and harvest need disjoint sparse attributes and the set grows; the alternatives are 12 sparse tables or EAV. Constrained per-type in the service layer. |
| **`status` / `stage` / `season` / `area_unit` stay `CHECK` constraints** | These are code-coupled state machines whose truth is the TypeScript union type — adding a value requires a code change anyway, so a lookup table would add a join and drift risk without extensibility gain. |

### Tables

**Reference (seeded):** `crop_catalog` · `expense_category` · `activity_type`

**Core:**

| Table | Key columns |
|---|---|
| `farmer` | `id` uuid PK · `auth_uid` varchar(128) UNIQUE · `phone` UNIQUE · `full_name` · `email` · `preferred_language` · `pin_hash` · `created_at` |
| `farm` | `id` PK · `farmer_id` FK · `name` · `area` · `area_unit` · `water_source` · `irrigation_type` · `farming_method` · `location_type` · `state` · `district` · `village` · `pincode` · `lat` · `lng` · `setup_completed` · `created_at` |
| `farm_crop` | `farm_id` FK + `crop_catalog_id` FK (composite PK) |
| `land` | `id` PK · `farmer_id` FK · `farm_id` FK · `name` · `area_sq_m` · `area_hectares` GENERATED · `area_acres` GENERATED · `notes` · `created_at` |
| `land_point` | `land_id` FK + `seq` (composite PK) · `lat` · `lng` |
| `crop` | `id` PK · `farmer_id` FK · `land_id` FK · `crop_catalog_id` FK · `area` · `area_unit` · `season` · `sowing_date` · `current_stage` · `status` · `expected_harvest_date` |
| `activity` | `id` PK · `farmer_id` FK · `parent_activity_id` FK NULL · `crop_id` FK NULL · `land_id` FK NULL · `activity_type_id` FK · `custom_activity_name` · **`date` NULL** · `season` · `status` · `notes` · `metadata` jsonb · `created_at` · `updated_at` |
| `activity_expense` | `id` PK · `activity_id` FK · `expense_category_id` FK · `item_id` · `resource_id` · `quantity` · `unit` · `rate` · `amount` · `remarks` · `created_at` |
| `activity_attachment` | `id` PK · `activity_id` FK · `storage_path` · `content_type` · `size_bytes` · `created_at` |
| `weather_snapshot` | `id` PK · `farmer_id` FK · `lat` · `lng` · `place_name` · `state` · `country` · expanded current-weather columns · `fetched_at` · `last_refreshed` · `is_stale` |
| `weather_forecast_day` | `id` PK · `snapshot_id` FK · `date` · `temp_max` · `temp_min` · `condition` · `condition_code` · `rain_probability` · `rainfall_mm` · `uv_index` · `sunrise` · `sunset` |
| `weather_alert` | `id` PK · `snapshot_id` FK · `type` · `severity` · `title` · `description` · `effective_at` · `expires_at` |

**Proposed RBAC** (separate migration — `userRole` is free text nothing
reads today): `role` · `farmer_role` · `module` · `role_module`.

`activity.date` is **nullable** — `Activity.date` is `date?: number` with
*"undefined = not yet scheduled"*. A `NOT NULL` column would reject every
unscheduled activity.

---

## 4. Firestore layout

```
farmers/{authUid}                     ← doc key = Firebase Auth uid (cheap rules)
  id (uuidv7), authUid, fullName, phone, email, preferredLanguage,
  pinHash, createdAt, schemaVersion
  farms/{farmId}
    name, area, areaUnit, waterSource, irrigationType, farmingMethod,
    locationType, state, district, village, pincode, location{lat,lng},
    setupCompleted, primaryCrops[]     ← bounded value list, stays inline
  lands/{landId}
    farmId, name, points[]{lat,lng}, areaSqM, notes, createdAt
  crops/{cropId}
    landId, cropCatalogId, area, areaUnit, season, sowingDate,
    currentStage, status, expectedHarvestDate
  activities/{activityId}
    parentActivityId, cropId, landId, activityTypeId, customActivityName,
    date, season, status, notes, metadata{}, createdAt, updatedAt
    expenses/{expenseId}               ← subcollection; only ever read per-activity
    attachments/{attachmentId}         ← Storage path, never the blob
  weather/{snapshotId}
    location{}, current{}, fetchedAt, lastRefreshed, isStale
    forecast/{dayId}
    alerts/{alertId}

cropCatalog/{id} · expenseCategories/{id} · activityTypes/{id}   ← global, read-only
roles/{id} · modules/{id} · roleModules/{id}                     ← global, proposed

storage: farmers/{authUid}/activities/{activityId}/{file}
```

Security rule shape — one clause, zero reads:

```
match /farmers/{uid}/{doc=**} {
  allow read, write: if request.auth.uid == uid;
}
match /{col}/{doc} {
  allow read: if col in ['cropCatalog','expenseCategories','activityTypes','roles','modules'];
}
```

---

## 5. Portability contract

Nine rules, each preventing a specific way Firestore data fails to load into
Postgres. Cheap now, non-negotiable later.

1. **Every document stores its own `id`** — a Firestore export contains
   document bodies, not keys. Without this an export has no primary key.
2. **Every document stores all foreign keys explicitly**, including
   `farmerId`, even though the path implies it. *This is the highest-value
   rule:* it is what turns a nested export into flat, loadable tables.
3. **Timestamps are epoch-millis `number`** — never `Timestamp`, never a
   `serverTimestamp()` sentinel. Postgres loads via `to_timestamp(ms/1000.0)`.
4. **IDs are UUIDv7** (§2), one format everywhere.
5. **No Firestore-only types stored** — no `GeoPoint` (use `{lat,lng}`), no
   `DocumentReference` (use the id string).
6. **Arrays only for small, bounded, atomically-read value lists**
   (`primaryCrops[]`, polygon `points[]`). Anything unbounded or
   independently queried is a subcollection, because a subcollection maps to
   a child table and an array does not.
7. **Maximum two subcollection levels** under the farmer document.
8. **No denormalised copy is ever the source of truth.** Derived fields are
   marked, recomputable, and dropped at migration.
9. **Every document carries `schemaVersion`**, so migrations are
   incremental, detectable, and resumable.

### Scalability limits designed for

| Limit | Response |
|---|---|
| 1 MB document cap | Attachments are Storage paths in a subcollection, never inline base64; `metadata{}` stays a bounded per-activity bag |
| ~1 sustained write/sec per document | No counters or rollups on the farmer document; expense totals computed client-side from the loaded subcollection |
| Unbounded cache growth | Weather is a 30-min-TTL cache on a **90-day rolling window per farmer**, explicitly not migrated |
| Query cost | Composite indexes driven by the activity list's real filters/sorts; pagination via `orderBy + startAfter`, never `offset` |
| Cross-farmer analytics | Would need collection-group indexes — a known, accepted future cost of nesting |

---

## 6. Implementation stages

| Stage | Scope | Touches app code |
|---|---|---|
| **A — Schema** | `db/schema.ts` (source of truth), `db/postgres/*.sql`, `db/firestore/{structure.md,firestore.rules,firestore.indexes.json}`, both migration docs | No |
| **B — Shared types + UUIDv7** | `core/data/uuid.ts` (+ spec) and generated types the app imports, so models and schema cannot drift | Small |
| **C — Firebase backend** | Per `PHASE_5_PLAN.md`: environments + `fileReplacements`; Firebase Auth phone OTP behind the existing `authGuard` contract; `FirestoreStorageService` behind `IStorageService`; move the four bypassing services onto the seam; offline persistence; Cloud Function weather proxy; CI secret injection | Yes |
| **D — Data migration** | localStorage → Firestore, with the ID remap from §2, gated by a completion flag following `features/activity/migration.ts` | Yes |
| **E — Postgres (future)** | Apply `db/postgres/*.sql`; export → load per §7; swap DI to an API-backed `IStorageService` | Later |

**Recommendation: approve A and B now.** They are additive, carry no runtime
risk, and every later stage depends on the identifier and schema decisions
being settled first. C and D are Phase 5 proper and deserve their own review.

---

## 7. Firestore → Postgres migration

Deliberately boring, which is the point:

1. `gcloud firestore export` → newline-delimited JSON per collection.
2. **Flatten** — thanks to rules 1 and 2 every document already carries its
   `id` and all parent keys, so this is a camelCase → snake_case rename. **No
   path parsing, no key reconstruction.**
3. **Load in FK order:** `crop_catalog`/`expense_category`/`activity_type` →
   `farmer` → `farm` → `farm_crop` → `land` → `land_point` → `crop` →
   `activity` → `activity_expense`/`activity_attachment`. Weather is not
   migrated; it refetches.
4. **Convert** epoch millis → `timestamptz`; inline arrays → child rows
   (`points[]` → `land_point`, `primaryCrops[]` → `farm_crop`).
5. **Reconcile referential integrity** that Firestore never enforced:
   unresolvable `land_id` / `crop_id` values are set `NULL` and written to a
   rejects log rather than failing the load.
6. **Verify:** per-table row count equals per-collection document count and
   the id sets match. Any mismatch fails the migration.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Rule 2 skipped in Stage C because "the parent id is already in the path" | Stated in `db/README.md`; `FirestoreStorageService` writes go through one mapper that sets `farmerId`, and a Stage D validation pass rejects documents missing it |
| Dropping `land.geo_json` and `crop.upcoming_activity` breaks readers | Both are derived, but **app code reads them today**. Stage C must add service-layer recomputation *before* the fields are removed — sequenced, not simultaneous |
| Splitting `farmer` into `farmer` + `farm` ripples into registration | The split is 1:1 today; `FarmerRegistrationData` keeps its shape at the service boundary and the mapper writes two documents |
| ID remap loses a reference during Stage D | Remap table is built first and migration **fails loudly** on any unresolved reference |
| Schema and TS models drift | Stage B generates the types the app imports; until then `schema.ts` carries a `source` pointer per entity |
| Only one service uses `IStorageService` today | Stage C explicitly includes moving the other four; otherwise "backend swap" is one feature wide |

## 9. Verification

- **A:** every column in `postgres/*.sql` and field in `firestore/structure.md`
  matches `db/schema.ts`, which matches the real model files;
  `firestore.indexes.json` valid against Firestore's index-config schema.
- **B:** UUIDv7 generator unit-tested for RFC 9562 layout, monotonicity
  within a millisecond, and lexicographic-vs-chronological ordering.
- **C:** `firestore.rules` exercised in the Firebase emulator for per-farmer
  isolation; existing 29 Karma specs stay green plus new specs for
  `FirestoreStorageService` and the updated `AuthService`; `npm run lint`,
  `npm run format:check`, `npm run build` (the CI gate) all pass.
- **D:** migrate a seeded localStorage fixture, then assert row counts, id
  remapping, and referential integrity end to end.
- SQL is reviewed for syntax only — no Postgres instance exists in this
  environment to execute it against.
