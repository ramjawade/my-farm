# Backend Plan: FastAPI + Postgres (free tier), Firebase Auth retained

The complete backend design: hosting, framework, layering, auth, API shape,
schema, offline sync, type generation, CI/CD, and staging.

### What this supersedes

| Decision | Previously | **Now** |
|---|---|---|
| Database | Cloud Firestore | **PostgreSQL** |
| Server tier | None (Backend-as-a-Service) | **Python FastAPI** |
| Authentication | Firebase Auth phone OTP | **Unchanged — Firebase Auth retained** |
| Authorization | Firestore security rules | **Application-level tenant scoping** (§6 — this is now the top security risk) |
| Offline | Firestore offline persistence | **Hand-built IndexedDB outbox** (§9) |
| Attachments | Firebase Cloud Storage | Object storage, decision in §3.3 |

`PHASE_5_PLAN.md`'s **Firestore** decision is superseded; its **Firebase
Auth** decision stands. Everything in this document that concerns
identifiers (UUIDv7) and normalisation (3NF) carries over unchanged — those
choices were made to be backend-neutral and they paid off.

---

## 1. Target architecture

```
Browser — Angular 20 PWA (GitHub Pages, static)
   │
   ├── Firebase Auth SDK ──▶ Firebase Auth          [phone OTP → ID token (JWT)]
   │                                │
   │   Authorization: Bearer <ID token>
   ▼                                ▼
FastAPI (Render, Singapore) ──verify_id_token()──▶ Google public keys
   │  Pydantic validation · tenant scoping · business rules
   ▼
SQLAlchemy 2.0 async + asyncpg
   │
   ▼
Neon Postgres (Singapore, pooled endpoint)
```

Writes never block on the network: they land in an **IndexedDB outbox** and
sync in the background (§9).

---

## 2. Hosting and the free tier

Free tiers move constantly; these were checked in **September 2026** and
must be re-verified at implementation.

### 2.1 Postgres — **Neon**

| | **Neon** | Supabase |
|---|---|---|
| Storage | 0.5 GB / project | 500 MB |
| Projects | up to 100 | 2 |
| Compute | 100 CU-hours/mo, autoscale to 2 CU | — |
| Idle behaviour | **scale-to-zero, wakes automatically** | **pauses after 1 week idle — manual unpause required** (tightened Feb 2026) |
| Nearest region | **Singapore** (no India region) | Singapore |
| Card required | No; never expires; commercial use allowed | No |

**Supabase is disqualified by the idle-pause**, not by its limits. This is a
seasonal farming app — quiet fortnights between sowing and harvest are
normal, and a farmer returning to a dead app that needs manual dashboard
intervention is not a product. Neon's scale-to-zero wakes on connection.

**Choose Neon, Singapore** — the closest free region to India; Neon has no
Mumbai region.

### 2.2 API host — **Render**

| | **Render** | Koyeb | Fly.io |
|---|---|---|---|
| Free instance | 512 MB, 0.1 CPU | 512 MB, 0.1 vCPU, 2 GB SSD | **No free tier for new signups** |
| Allowance | 750 instance-hours / workspace / month | 1 instance per org | — |
| Idle | spins down after 15 min; **~1 min cold start** | scale-to-zero after 1 h (cannot disable) | — |
| Regions | Oregon, Ohio, Virginia, Frankfurt, **Singapore** | **Frankfurt or Washington DC only** | — |

**Choose Render, Singapore.** Koyeb's free instance cannot run in Asia,
which is disqualifying for an India-facing app. Render and Neon both in
Singapore keeps API↔DB latency inside one region.

### 2.3 Why a ~1-minute cold start is acceptable here

For a synchronous app it would not be. **The offline outbox makes it
invisible:** a farmer's write completes locally against IndexedDB and the
sync worker drains the queue in the background, retrying through the cold
start. The offline decision and the free-tier decision reinforce each other
— this is the single reason this architecture works on free infrastructure.

Reads on a cold app are the exception, so the client renders from its local
cache first and reconciles when the delta pull returns.

### 2.4 When the free tier breaks

| Ceiling | Trigger | Response |
|---|---|---|
| Neon 0.5 GB | ~1–2 M activity rows; **attachments would blow it instantly** | Attachments never enter Postgres (§3.3) |
| Neon 100 CU-h/mo | Sustained traffic, or a bad query keeping compute awake | Scale-to-zero + indexed queries; Launch tier is $19/mo |
| Render 750 h/mo | One always-on service is ~730 h — fits, but only one | Second service (e.g. a worker) forces a paid plan |
| 0.1 CPU / 512 MB | Concurrency, not throughput, is the limit | Single uvicorn worker, fully async, no sync ORM calls |

### 2.5 Attachments

Activity photos must not live in Postgres (0.5 GB) or in a row. Options, to
be settled at implementation: **Cloudflare R2** (10 GB free, no egress fees)
is the safest default; Firebase Cloud Storage is convenient since a Firebase
project already exists for Auth, but **verify its current free-tier terms
first** — Firebase has moved Cloud Storage behind the paid plan for newer
projects. The API stores only `storage_path`, never the blob, either way.

---

## 3. Backend stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Python 3.12+** | — |
| Framework | **FastAPI** + **Uvicorn** (single worker) | Async, and its OpenAPI output drives client type generation (§10) |
| ORM | **SQLAlchemy 2.0, async** | Typed 2.0 style; async required so 0.1 CPU isn't blocked on I/O |
| Driver | **asyncpg** | Fastest async Postgres driver |
| Migrations | **Alembic** | Autogenerated from models, reviewed by hand |
| Schemas | **Pydantic v2** | Validation + the OpenAPI contract |
| Auth | **firebase-admin** | `verify_id_token()` |
| Tests | **pytest** + **httpx.AsyncClient** + testcontainers or a Neon branch | Real Postgres in tests, not SQLite |
| Lint/format | **ruff** | Mirrors the frontend's eslint/prettier gate |

**Connection pooling is mandatory.** Use Neon's **pooled endpoint**
(`-pooler` host) and keep SQLAlchemy modest — `pool_size=5,
max_overflow=0, pool_pre_ping=True`. A 0.1-CPU instance cannot use more, and
`pool_pre_ping` handles connections dropped while the database was scaled to
zero.

### 3.1 Layout

Monorepo — the API lives beside the Angular workspace so a schema change and
its client update land in one PR.

```
api/
  app/
    main.py                 FastAPI app, CORS, lifespan
    core/       config.py · security.py (Firebase) · db.py (engine, session)
    models/                 SQLAlchemy — SOURCE OF TRUTH for the schema
    schemas/                Pydantic request/response
    repositories/           base.py enforces tenant scoping (§6.2)
    routers/                farmers · farms · lands · crops · activities · expenses · sync
    services/               business rules (stage transitions, derived fields)
  alembic/versions/
  tests/
  pyproject.toml · Dockerfile
projects/home/              existing Angular app
```

---

## 4. Schema

The 3NF design carries over unchanged — `farmer` · `farm` · `farm_crop` ·
`land` · `land_point` · `crop` · `activity` · `activity_expense` ·
`activity_attachment` · `weather_snapshot` · `weather_forecast_day` ·
`weather_alert`, plus reference tables `crop_catalog` ·
`expense_category` · `activity_type`, plus proposed RBAC (`role` ·
`farmer_role` · `module` · `role_module`).

**SQLAlchemy models are now the single source of truth**; Alembic generates
the migrations. The previously planned hand-written `db/schema.ts` and raw
`.sql` files are dropped — they existed to keep two hand-maintained
representations in step, and a real ORM plus generated client types (§10)
removes that whole class of drift.

### 4.1 Additions required by offline sync

Every syncable table gains:

| Column | Purpose |
|---|---|
| `updated_at timestamptz NOT NULL` | Delta-pull watermark and last-write-wins comparison |
| `deleted_at timestamptz NULL` | **Soft delete.** A hard delete is invisible to a client that was offline when it happened, so deletes must be tombstones to propagate |

Retained from earlier analysis: **`activity.date` is nullable**
(`undefined = not yet scheduled`); ids are **UUIDv7** in native `uuid`
columns; `farmer.id` is UUIDv7 with `auth_uid varchar(128) UNIQUE` holding
the Firebase uid; `activity.metadata` stays `jsonb` deliberately.

UUIDv7 matters more here than it did under Firestore: **the client mints ids
offline**, so they must be collision-free without the server and ordered
enough to index well.

---

## 5. API design

`/api/v1/...`, REST, resource-per-entity, cursor-paginated.

```
GET    /api/v1/me                          current farmer (JIT-provisioned)
CRUD   /api/v1/farms|lands|crops|activities|activities/{id}/expenses
GET    /api/v1/reference/{crops|expense-categories|activity-types}
POST   /api/v1/sync/push                   outbox batch
GET    /api/v1/sync/pull?since=<ts>        delta
```

- **Per-entity CRUD, never bulk-replace.** The old `saveCrops(userId,
  crops[])` shape causes lost updates between devices; this API has no
  endpoint that can express it.
- **Pagination** `?cursor=&limit=` on `updated_at,id` — never `OFFSET`.
- **Errors** RFC 9457 `application/problem+json`, so the client has one
  shape to handle.
- **No endpoint accepts a farmer id** — tenancy comes from the token only
  (§6.2).

---

## 6. Auth and tenancy

### 6.1 Flow

1. Angular runs Firebase phone OTP → Firebase ID token (JWT).
2. Client sends `Authorization: Bearer <token>`.
3. A FastAPI dependency verifies it with `firebase_admin.auth.verify_id_token()`
   (signature, expiry, audience) and extracts `uid`.
4. The farmer row is looked up by `auth_uid`, **created on first call**
   (just-in-time provisioning) — registration needs no separate endpoint.
5. The request carries a `CurrentFarmer` with the internal UUIDv7 `id`.

Google's signing keys are cached by `firebase-admin`; a cold start costs one
extra fetch.

### 6.2 Tenant isolation is now application code — the top risk

Under Firestore, `request.auth.uid == uid` made cross-tenant access
impossible at the database. **That guarantee is gone.** One missing
`WHERE farmer_id = :id` is a cross-farmer data leak, and it will not fail
any test that only checks the happy path.

Three layers, because one is not enough:

1. **A base repository that cannot be used unscoped** — it takes
   `farmer_id` in its constructor and injects the predicate into every
   query. Routers never write raw filters.
2. **Postgres Row-Level Security** as defence in depth: a session variable
   set per request, and RLS policies on every farmer-owned table. Costs
   little and turns a code bug into a denied query.
3. **A negative test per endpoint** — farmer A requests farmer B's row and
   must get 404 (not 403, which confirms existence). This is a required
   part of Stage C, not optional.

---

## 7. Sync protocol

**Push** — the outbox posts a batch of mutations, each with its
client-generated UUIDv7 and a `client_mutation_id`:

- The server **upserts by primary key**, so a retried batch is a no-op —
  idempotency comes free from client-side ids.
- Per-item results, so one bad item cannot fail the batch.

**Pull** — `GET /sync/pull?since=<updated_at>` returns rows changed since
the watermark, tombstones included, in `updated_at` order with a cursor.

**Conflicts** — last-write-wins on `updated_at`, with the server as clock
authority (client clocks in the field are unreliable). Losing versions are
logged. LWW is acceptable because in practice one farmer uses one device per
record; it is *not* acceptable for the expense totals, which are derived and
recomputed rather than synced.

---

## 8. Offline outbox (client)

Behind the existing service worker:

- **IndexedDB stores** — `outbox` (pending mutations) and `cache`
  (last-known server state per entity).
- Feature services write to the local store and enqueue; the UI reads local
  state, so it never waits on the network.
- A sync worker drains the outbox on reconnect with exponential backoff,
  then runs a delta pull.
- **`ApiStorageService`** implements the existing `IStorageService` and hides
  all of this, so components and feature services do not change.

Prerequisite carried forward: `IStorageService`'s bulk-replace methods
(`saveCrops`, `saveFarms`, `saveWeatherHistory`) must become per-entity CRUD
first, and `getFarmers()` / `saveFarmers()` — which read the global farmer
registry — must be **deleted**, since no authenticated API can expose all
farmers. Firebase Auth owns identity lookup.

---

## 9. Type generation — one contract, no drift

FastAPI publishes OpenAPI from the Pydantic schemas. CI runs
`openapi-typescript` to generate the Angular client's types.

```
SQLAlchemy models ──Alembic──▶ Postgres
        │
        └── Pydantic ──▶ OpenAPI ──openapi-typescript──▶ Angular types
```

**CI fails if the generated types are stale**, so a backend field change
cannot merge without the frontend seeing it. This replaces the hand-written
shared-schema file the earlier plan proposed.

---

## 10. Data migration — localStorage → Postgres

Now a single hop; the Firestore intermediate is gone.

1. On first authenticated login post-deploy, detect legacy localStorage keys
   (`my_farm_${userId}_{activities,activity_expenses,crops,saved_farms}`,
   plus the legacy pre-migration keys already handled by
   `features/activity/migration.ts`).
2. **Mint a UUIDv7 per record from its real `createdAt`**, preserving
   historical order, and build an **old-id → new-id remap first**.
3. Rewrite every reference (`fieldId`, `cropId`, `activityId`,
   `parentActivityId`) through the remap; **fail loudly** on any unresolved
   reference rather than dropping it.
4. Push through `/sync/push` in FK order; the endpoint's upsert semantics
   make a partial run safely resumable.
5. Gate on a completion flag, following the existing migration pattern.
6. Weather is not migrated — it refetches.

---

## 11. CI/CD

Extends the existing workflow rather than replacing it:

- **Frontend** — unchanged: lint → format:check → test → build → GitHub Pages.
- **Backend** — ruff → mypy → pytest (against a real Postgres) → build image
  → deploy to Render.
- **Migrations** — Alembic runs from CI against Neon *before* the new image
  goes live, so a failed migration blocks the deploy rather than crash-looping
  a started container.
- **Contract check** — regenerate TS types; fail if the working tree changes.
- **Secrets** — GitHub Actions secrets for the Neon URL and the Firebase
  service account; Render env vars at runtime. The existing
  `environment.prod.ts` stamping gains the API base URL.
- **CORS** — the API allowlists the GitHub Pages origin explicitly.

---

## 12. Stages

| Stage | Scope | Blocks |
|---|---|---|
| **1 — Seam repair** | Per-entity CRUD on `IStorageService`; delete `getFarmers()`/`saveFarmers()`; still on localStorage | Everything |
| **2 — API skeleton** | FastAPI app, Neon + Render provisioned, `/health`, Firebase token dependency, base repository + RLS, CI | 3 |
| **3 — Domain endpoints** | Models, Alembic migrations, CRUD routers, reference data, **negative tenancy tests per endpoint** | 4 |
| **4 — Client integration** | Generated types; `ApiStorageService` behind `IStorageService`; online-only first | 5 |
| **5 — Offline outbox** | IndexedDB outbox + sync worker; `/sync/push` + `/sync/pull`; tombstones | 6 |
| **6 — Data migration** | localStorage → Postgres per §10, behind a flag | — |
| **7 — Weather + attachments** | Weather proxy endpoint (retires the client-side key); attachment upload to object storage | — |

Stage 1 is deliberately first and separate: refactoring the seam *while*
introducing a network backend is how these migrations fail.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| **Cross-tenant leak** — one missing `WHERE farmer_id` | §6.2's three layers; negative tests are a merge requirement |
| **Free tier moves** — limits checked Sept 2026 | Re-verify at Stage 2; the design survives a provider swap because only `DATABASE_URL` and the host change |
| Neon idles to zero mid-request | Pooled endpoint + `pool_pre_ping`; outbox retries absorb it |
| Render cold start degrades UX | Acceptable only because of the outbox (§2.3); if offline is descoped, this becomes a paid-tier decision |
| **0.5 GB storage** | Attachments never in Postgres; weather on a 90-day rolling window; row-count alerting before the ceiling |
| LWW loses a concurrent edit | Acceptable for single-device-per-record use; losers logged; derived totals recomputed, never synced |
| Losing Firestore's offline persistence is underestimated | It is the largest item in the move and gets its own stage (5), not a checkbox in another |
| Alembic autogenerate emits a destructive migration | Every migration reviewed by hand; CI runs them against a scratch database first |
| Firebase Auth remains a dependency | Deliberate — it is the only piece providing working phone OTP; the token boundary is thin enough to replace later |

---

## 14. Verification

- **Stage 1** — existing 29 Karma specs stay green through the interface change.
- **Stage 2** — `/health` reachable from the GitHub Pages origin (proves CORS);
  a request with a forged/expired token is rejected.
- **Stage 3** — pytest against real Postgres; **every endpoint has a
  cross-tenant test returning 404**; Alembic up/down runs clean.
- **Stage 4** — type generation is byte-identical in CI; app works end to end
  online.
- **Stage 5** — airplane-mode test: create/edit/delete offline, reconnect,
  confirm convergence; a replayed batch changes nothing (idempotency).
- **Stage 6** — migrate a seeded localStorage fixture; assert row counts, id
  remapping, and referential integrity.
- Full gate: `ruff`, `mypy`, `pytest`, `npm run lint`, `format:check`,
  `test`, `build`.

---

*Free-tier figures verified September 2026 from provider documentation and
comparison sources; see the PR description for links. Re-verify at Stage 2.*
