# Backend & Data Plan: One Model, Firebase Now, Postgres Later

Consolidates the backend and database design into a single document:
technology stack, layering, identifier strategy, normalised schema,
Firestore layout, the portability contract, and the implementation stages.

- **Supersedes** `DB_SCHEMA_PLAN.md` (renamed to this file).
- **Extends** `PHASE_5_PLAN.md`, which decided the backend but said nothing
  about layering, identifiers, normalisation, or relational portability.
  Where this document is more specific, it wins; nothing here contradicts
  that plan's Firebase decision.

---

## 1. Stack

Verified from `package.json`, `app.config.ts`, `angular.json`, and
`.github/workflows/`.

| Layer | Choice | Status |
|---|---|---|
| Frontend | **Angular 20.3** — standalone components, **signals**, **zoneless** change detection | In use |
| Language | **TypeScript 5.9** | In use |
| UI | Bootstrap 5.3 + bootstrap-icons; **Chart.js 4.5** and **D3 7.9**; **Leaflet 1.9** (field drawing) | In use |
| Async | RxJS 7.8 | In use |
| Offline | `@angular/service-worker` PWA, registered in `app.config.ts` | In use |
| Config | `src/environments/` + `angular.json` `fileReplacements` | **In use** |
| Persistence (today) | `localStorage` behind `IStorageService` | In use |
| **Auth (target)** | **Firebase Auth** — phone OTP; PIN demoted to a local device re-lock | Not started |
| **Database (target)** | **Cloud Firestore** + offline persistence | Not started |
| **Files (target)** | **Firebase Cloud Storage** — activity photos | Not started |
| **Server code (target)** | **Cloud Functions** — weather proxy holding the OpenWeatherMap key | Not started |
| **Database (later)** | **PostgreSQL** behind an HTTP API tier (see §2.5) | Future |
| Hosting / CI | GitHub Actions (Node 24: lint → format:check → test → build) → GitHub Pages | In use |
| Tests | Karma + Jasmine (29 specs), ESLint 10, Prettier | In use |

No Firebase package is installed yet — Phase 5 has not begun. The SDK choice
is the modular `firebase` JS SDK over `@angular/fire`, per `PHASE_5_PLAN.md`.

> **Correction to `PHASE_5_PLAN.md`:** it states *"No `src/environments/`
> exists at all in either project"* and that no CI secret injection exists.
> Both have since landed on `main` — `environment.ts` / `environment.prod.ts`
> exist with `fileReplacements` wired in `angular.json`, and
> `api.config.ts` already reads `environment.openWeatherApiKey`. That work is
> **done**, and Stage C shrinks accordingly.

---

## 2. Layering — how the front end reaches the database

### 2.1 There is no server tier today, and that is a choice

Phase 5's architecture is **Backend-as-a-Service**: the browser talks
*directly* to Firestore using the client SDK, and **Firestore security rules
take the place of a server's authorization layer**. The only server-side code
in the whole design is one Cloud Function, and it exists solely to hold the
OpenWeatherMap key.

```
Browser (Angular)  ──Firestore SDK──▶  Firestore     [authz = security rules]
                   ──HTTPS──────────▶  Cloud Function ──▶ OpenWeatherMap
                                                          [holds the API key]
```

The consequences are real and should be accepted knowingly:

- **Business logic runs on the client and cannot be trusted.** Anything that
  must be enforced (quotas, cross-farmer invariants, audit trails) has to be
  a security rule or a Cloud Function — not a service method.
- **Security rules are the entire authorization layer.** A rules bug is a
  data breach; hence the emulator tests in §10.
- **It does not extend to Postgres at all** — see §2.5.

### 2.2 The in-app middle layer (ports and adapters)

What makes the backend swappable is not the network protocol, it is the seam
inside the app. Target layering:

```
Components (signals, zoneless)
      ↓  read signals, call methods
Feature services — ActivityService, CropTimelineService, FarmDrawService…
      ↓  business logic lives here, backend-agnostic
IStorageService / IWeatherService            ← the ports (already in app.config.ts)
      ↓
LocalStorageService | FirestoreStorageService | ApiStorageService   ← adapters
      ↓
Mapper: domain model ⇄ persistence shape      ← NEW; §6 enforced in ONE place
      ↓
localStorage  |  Firestore SDK  |  HTTPS API → Postgres
```

The **mapper** is the piece that does not exist yet and matters most. It is
the single place where ids, epoch-millis timestamps, and the explicit
foreign keys of §6 rule 2 get written. Without it, rule 2 has to be
remembered at every call site — and it will not be.

### 2.3 Two findings that block a network backend

**Finding 1 — the seam is half bulk-replace.** `IStorageService` is
inconsistent. Activities are granular (`saveActivity`, `updateActivity`,
`deleteActivity`), but everything else replaces a whole collection:

```ts
saveCrops(userId: string, crops: CropEntity[]): Promise<void>
saveFarms(userId: string, farms: SavedFarm[]): Promise<void>
saveWeatherHistory(userId: string, history: WeatherData[]): Promise<void>
```

Whole-array replace is fine for `localStorage`, wasteful in Firestore (every
edit rewrites every document in the collection), and unacceptable over HTTP.
Worse, it **creates lost-update races between devices** — the exact failure a
sync backend must not have. These must become per-entity CRUD **before**
Stage C, not during it.

**Finding 2 — `getFarmers()` / `saveFarmers()` cannot exist in Phase 5.**
They are unscoped: they read and write the registry of *all* farmers. Under
the rule in §5 a farmer cannot list other farmers — correctly, since that
would be a data breach. These methods exist only because `localStorage`
needed a global registry for login lookup; **Firebase Auth owns identity
lookup instead**. They must be *deleted*, not ported, and
`auth.service.ts` / `farmer-registration.service.ts` reworked onto
`getCurrentFarmer()` / `saveCurrentFarmer()`.

### 2.4 Server-tier options

| # | Shape | Offline | Postgres-ready | Verdict |
|---|---|---|---|---|
| 1 | **Direct SDK** — browser → Firestore | ✅ built in | ❌ none | Phase 5 baseline |
| 2 | **Functions-as-API** — browser → HTTPS Functions → Firestore | ❌ lost | ✅ contract set early | Too costly now |
| 3 | **Hybrid** — SDK for data, Functions for privileged/secret work | ✅ kept | ⚠️ partial | **Recommended** |
| 4 | **Custom API now** — browser → Node/NestJS → Postgres | ❌ hand-rolled | ✅ | Contradicts Phase 5 |

**Recommendation: option 3.** Keep the Firestore SDK for data, because
offline persistence is a *product* requirement for rural connectivity and is
the single biggest reason Firebase was chosen — routing reads through
Functions (option 2) throws it away and adds cold starts. Use Cloud
Functions only where server-side trust is genuinely required: the weather
key proxy today, and later anything needing validation the client cannot be
trusted to perform.

Portability comes from `IStorageService`, **not** from adopting HTTP early.

### 2.5 The Postgres-era middle layer, and its honest cost

A browser cannot talk to Postgres — you cannot ship database credentials to
a client, and Postgres speaks a TCP wire protocol, not HTTP. **So Stage E is
not merely a data migration; it is building a server tier that does not
exist today.** It needs:

- an **HTTP API** implementing the same operations as `IStorageService`;
- **auth token verification** server-side — Firebase Auth tokens verify via
  the Admin SDK, so authentication itself need not change;
- **connection pooling** (PgBouncer) — serverless plus Postgres exhausts
  connections otherwise;
- **offline rebuilt from scratch.** This is the cost nobody budgets for.
  Firestore's offline persistence and conflict resolution disappear, and an
  offline-first field app would need an IndexedDB outbox with sync and
  conflict resolution behind the service worker. **For this app that is the
  largest single item in a Postgres migration — larger than the schema
  work.**

**Therefore: evaluate Supabase at Stage E before assuming raw Postgres.** It
*is* Postgres, and it ships most of this middle layer — PostgREST-generated
REST plus realtime, and row-level security that maps almost one-to-one onto
the Firestore rules in §5. `PHASE_5_PLAN.md` rejected Supabase as the *now*
backend; as the *Postgres destination* it removes most of the custom API
tier. The schema in §4 is plain Postgres either way, so this choice can be
deferred without cost.

---

## 3. Identifier strategy — **UUIDv7 everywhere**

**Decision: every entity uses a client-generated UUIDv7 primary key, stored
as Postgres `uuid` and as the Firestore document key.**

### Why not numeric auto-increment

- **Firestore has no sequences.** Emulating one needs a central counter
  document, which caps at roughly **1 sustained write/second** — the exact
  ceiling the highest-write-volume table (`activity`) would hit first.
- **They break offline.** A record created offline cannot be assigned a
  sequential ID until it syncs, so it has no stable identity to reference in
  the meantime — fatal for an offline-first PWA.
- They also leak record counts and invite enumeration.

### Why UUIDv7 rather than UUIDv4

UUIDv7 (RFC 9562) puts a 48-bit Unix-millisecond timestamp in the high bits,
keeping every v4 property while adding time ordering:

| Property | v4 | **v7** |
|---|---|---|
| Client-generated, works offline | ✅ | ✅ |
| Collision-free without coordination | ✅ | ✅ |
| Postgres native `uuid`, 16 bytes | ✅ | ✅ |
| **Sequential B-tree inserts** (no random page splits on `activity`) | ❌ | ✅ |
| **Chronological sort by key** — Firestore orders lexicographically, so `orderBy(__name__)` is free chronological ordering | ❌ | ✅ |

Cost is a ~15-line generator (`crypto.randomUUID()` emits v4 only) in
`core/data/uuid.ts`, unit-tested for layout and monotonicity.

If a human-facing short reference is ever wanted, Postgres adds
`display_no bigint GENERATED ALWAYS AS IDENTITY` — a numeric label, never the
key.

### The one exception, handled explicitly

- `farmer.id` — **UUIDv7**, like every other table. Internal identity.
- `farmer.auth_uid varchar(128) UNIQUE` — the Firebase Auth uid.

This keeps the internal format 100% consistent and decouples the model from
the auth provider. Firestore still keys the farmer document by `auth_uid`
(`farmers/{uid}`) because that makes the security rule a single zero-read
clause; the document body carries both `id` and `authUid`.

### Normalising the existing IDs

Five incompatible formats are in use today:

| Entity | Current generator | Source |
|---|---|---|
| `farmer` | `'f-' + rand36 + '-' + time36` | `farmer-registration.service.ts:78` |
| `crop` | `'c-' + rand36 + '-' + time36` | `crop-timeline.service.ts:124` |
| `land` | `crypto.randomUUID()` (v4) | `farm-draw.service.ts:120` |
| `activity` | `` `activity_${now}_${rand9}` `` | `activity.service.ts:118` |
| `activity_expense` | `` `expense_${now}_${rand9}` `` | `activity.service.ts:179` |

The localStorage→Firestore migration mints a **new UUIDv7 per record seeded
from that record's real `createdAt`**, preserving historical ordering. It
builds an **old-id → new-id remap first**, then rewrites every reference
(`fieldId`, `cropId`, `activityId`, `parentActivityId`) through it, and
**fails loudly** on any unresolved reference.

---

## 4. Normalised schema (3NF)

### Normalisation decisions

| Change | Reason |
|---|---|
| **Split `farmer` into `farmer` + `farm`** | Farm attributes (`farmName`, `farmArea`, `waterSource`, `irrigationType`, `farmingMethod`, location) describe a *farm*, not a person. Also unblocks multi-farm accounts. |
| **Add `crop_catalog` lookup** | `primaryCrops[]`, `crop.name`, `crop.cropType` are repeated free text. |
| **Add `expense_category` lookup** | `activity_expense.category` is free text ('Labour', 'Seeds', 'Machine Rent'). |
| **Add `activity_type` lookup** | 12 values plus a `Custom` escape hatch — data, not a state machine. |
| **Drop `land.geo_json`** | Fully redundant with `land_point` rows. Regenerated on read. |
| **`land.area_hectares` / `area_acres` → `GENERATED ALWAYS AS … STORED`** | Transitive dependency on `area_sq_m`; generated columns keep read speed without the 3NF violation. |
| **Drop `crop.upcoming_activity`** | Derived — the crop's next scheduled activity. |
| **Expand `weather_snapshot.current` into columns** | `CurrentWeather` has a fixed shape; a JSON blob hides it from the type system for no benefit. |
| **Keep `activity.metadata` as `jsonb`** | Deliberate exception: irrigation, spray and harvest need disjoint sparse attributes and the set grows. Alternatives are 12 sparse tables or EAV. |
| **`status` / `stage` / `season` / `area_unit` stay `CHECK`** | Code-coupled state machines whose truth is the TypeScript union — adding a value needs a code change anyway. |

### Tables

**Reference (seeded):** `crop_catalog` · `expense_category` · `activity_type`

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

**Proposed RBAC** (separate migration — `userRole` is free text nothing reads
today): `role` · `farmer_role` · `module` · `role_module`.

`activity.date` is **nullable** — `Activity.date` is `date?: number`,
*"undefined = not yet scheduled"*. A `NOT NULL` column would reject every
unscheduled activity.

---

## 5. Firestore layout

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

## 6. Portability contract

Nine rules, each preventing a specific way Firestore data fails to load into
Postgres. Enforced in the mapper (§2.2), not at call sites.

1. **Every document stores its own `id`** — a Firestore export contains
   document bodies, not keys. Without this an export has no primary key.
2. **Every document stores all foreign keys explicitly**, including
   `farmerId`, even though the path implies it. *Highest-value rule:* it is
   what turns a nested export into flat, loadable tables.
3. **Timestamps are epoch-millis `number`** — never `Timestamp`, never a
   `serverTimestamp()` sentinel. Postgres loads via `to_timestamp(ms/1000.0)`.
4. **IDs are UUIDv7** (§3), one format everywhere.
5. **No Firestore-only types stored** — no `GeoPoint` (use `{lat,lng}`), no
   `DocumentReference` (use the id string).
6. **Arrays only for small, bounded, atomically-read value lists**
   (`primaryCrops[]`, polygon `points[]`). Anything unbounded or
   independently queried is a subcollection, because a subcollection maps to
   a child table and an array does not.
7. **Maximum two subcollection levels** under the farmer document.
8. **No denormalised copy is ever the source of truth.**
9. **Every document carries `schemaVersion`.**

### Scalability limits designed for

| Limit | Response |
|---|---|
| 1 MB document cap | Attachments are Storage paths in a subcollection, never inline base64; `metadata{}` stays a bounded per-activity bag |
| ~1 sustained write/sec per document | No counters or rollups on the farmer document; expense totals computed client-side |
| Unbounded cache growth | Weather is a 30-min-TTL cache on a **90-day rolling window per farmer**, not migrated |
| Query cost | Composite indexes driven by the activity list's real filters/sorts; pagination via `orderBy + startAfter`, never `offset` |
| Cross-farmer analytics | Would need collection-group indexes — a known, accepted cost of nesting |

---

## 7. Implementation stages

| Stage | Scope | Touches app code |
|---|---|---|
| **A — Schema** | `db/schema.ts` (source of truth), `db/postgres/*.sql`, `db/firestore/{structure.md,firestore.rules,firestore.indexes.json}`, migration docs | No |
| **B — Types + UUIDv7** | `core/data/uuid.ts` (+ spec); generated types the app imports so models and schema cannot drift | Small |
| **B2 — Seam repair** | Convert the bulk-replace methods to per-entity CRUD and delete `getFarmers()`/`saveFarmers()` (§2.3). **Blocks C.** | Yes |
| **C — Firebase backend** | Firebase Auth phone OTP behind the existing `authGuard` contract; `FirestoreStorageService` + mapper behind `IStorageService`; move the four bypassing services onto the seam; offline persistence; Cloud Function weather proxy. *(Environments/`fileReplacements` already done.)* | Yes |
| **D — Data migration** | localStorage → Firestore with the ID remap from §3, gated by a completion flag following `features/activity/migration.ts` | Yes |
| **E — Postgres (future)** | Choose Supabase vs. custom API (§2.5); apply `db/postgres/*.sql`; export → load per §8; swap DI to `ApiStorageService`; **rebuild offline** | Later |

**Recommendation: approve A, B and B2 now.** A and B are additive and
risk-free. B2 is the one that matters most for sequencing — it is a
refactor of existing code that Stage C would otherwise have to do while also
introducing Firebase, and doing both at once is how backend migrations go
wrong.

---

## 8. Firestore → Postgres migration

1. `gcloud firestore export` → newline-delimited JSON per collection.
2. **Flatten** — thanks to rules 1 and 2 every document already carries its
   `id` and all parent keys, so this is a camelCase → snake_case rename. **No
   path parsing, no key reconstruction.**
3. **Load in FK order:** `crop_catalog`/`expense_category`/`activity_type` →
   `farmer` → `farm` → `farm_crop` → `land` → `land_point` → `crop` →
   `activity` → `activity_expense`/`activity_attachment`. Weather refetches.
4. **Convert** epoch millis → `timestamptz`; inline arrays → child rows.
5. **Reconcile referential integrity** Firestore never enforced: unresolvable
   `land_id`/`crop_id` set `NULL` and written to a rejects log.
6. **Verify:** per-table row count equals per-collection document count and
   the id sets match. Any mismatch fails the migration.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **Stage C attempted before B2** — introducing Firebase and refactoring the seam at once | B2 is a hard prerequisite in §7; bulk-replace over a network causes lost-update races between devices |
| Rule 2 skipped because "the parent id is already in the path" | Enforced in the single mapper (§2.2), not per call site; Stage D validation rejects documents missing `farmerId` |
| Dropping `land.geo_json` and `crop.upcoming_activity` breaks readers | Both are derived, but **app code reads them today**. Stage C adds service-layer recomputation *before* removal — sequenced, not simultaneous |
| Splitting `farmer` into `farmer` + `farm` ripples into registration | 1:1 today; `FarmerRegistrationData` keeps its shape at the service boundary and the mapper writes two documents |
| ID remap loses a reference in Stage D | Remap built first; migration fails loudly on any unresolved reference |
| **Postgres migration underestimated** | §2.5 — the API tier and offline rebuild, not the schema, are the real cost; Supabase evaluated first |
| Security rules are the whole authorization layer | Emulator tests in §10; a rules bug is a data breach |

## 10. Verification

- **A:** every column in `postgres/*.sql` and field in `firestore/structure.md`
  matches `db/schema.ts`, which matches the real model files;
  `firestore.indexes.json` valid against Firestore's index-config schema.
- **B:** UUIDv7 generator unit-tested for RFC 9562 layout, monotonicity
  within a millisecond, and lexicographic-vs-chronological ordering.
- **B2:** existing specs stay green through the interface change;
  `LocalStorageService` gains per-entity CRUD specs.
- **C:** `firestore.rules` exercised in the Firebase emulator for per-farmer
  isolation *and* for denial of cross-farmer reads; 29 existing Karma specs
  green plus new `FirestoreStorageService` / `AuthService` specs;
  `npm run lint`, `format:check`, `test`, `build` (the CI gate) all pass.
- **D:** migrate a seeded localStorage fixture, then assert row counts, id
  remapping, and referential integrity end to end.
- SQL reviewed for syntax only — no Postgres instance exists in this
  environment to execute it against.
