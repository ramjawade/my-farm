# MyFarm Backend Plan

**FastAPI · PostgreSQL (Neon) · backend-issued PIN session JWT · online-only client**

The single canonical backend plan. Every decision here is settled — where a
choice existed, it has been made and the reasoning recorded. Nothing in this
document is left open.

**Status:** supersedes the original Firestore-backed plan (was
`PHASE_5_PLAN.md`, now removed — see `ROADMAP.md` §6) and `.diagram/er.md`
(an earlier, inaccurate ER sketch, kept with a pointer here).

---

## Table of contents

| § | Section |
|---|---|
| 1 | [Decisions at a glance](#1-decisions-at-a-glance) |
| 2 | [Architecture](#2-architecture) |
| 3 | [Hosting and the free tier](#3-hosting-and-the-free-tier) |
| 4 | [Backend stack and layout](#4-backend-stack-and-layout) |
| 5 | [Authentication and tenancy](#5-authentication-and-tenancy) |
| 6 | [Data model](#6-data-model) |
| 7 | [API design](#7-api-design) |
| 8 | [Frontend API contract types](#8-frontend-api-contract-types) |
| 9 | [CI/CD](#9-cicd) |
| 10 | [Delivery stages](#10-delivery-stages) |
| 11 | [Risks](#11-risks) |
| 12 | [Verification](#12-verification) |

---

## 1. Decisions at a glance

| Area | Decision |
|---|---|
| Server framework | **FastAPI** (Python 3.12), single Uvicorn worker |
| Database | **PostgreSQL on Neon**, Singapore, pooled endpoint |
| API host | **Render**, Singapore, free instance |
| Authentication | **Backend-issued PIN session JWT** (HS256, ~24h), online-only; the auth dependency also accepts a Firebase ID token so phone OTP can be layered on later (§5.1) |
| Authorization | Base-repository tenant scoping + per-endpoint cross-tenant 404 test (Postgres RLS designed in but **inert on Neon** — §5.2) |
| ORM / migrations | **SQLAlchemy 2.0 async + asyncpg**, **Alembic** |
| Schema source of truth | **SQLAlchemy models** → Alembic for the DB; the client hand-maintains its own API contract types (§8) |
| Identifiers | **UUIDv7** server default, native `uuid` columns; create endpoints accept client-supplied ids (§6.1) |
| Attachments | **Cloudflare R2** (10 GB free, zero egress) |
| Weather cache | **Server-side, shared by location grid** — not per farmer |
| Repository | **Monorepo** — `projects/backend/`, beside the Angular projects |
| RBAC (`role`/`module`) | **Excluded from v1** |

### Previously-open items, now settled

| Item | Decision | Why |
|---|---|---|
| Attachment storage | **Cloudflare R2** | Firebase has moved Cloud Storage behind the paid plan for newer projects, so it is not reliably free. R2's zero egress matters because field photos are re-read on mobile. |
| Test database | **GitHub Actions `services: postgres:16`** | Real Postgres in CI without Neon credentials or branch cleanup. |
| Alembic execution | **From CI, before the new image goes live** | A failed migration blocks the deploy instead of crash-looping a started container. |
| Postgres RLS | Designed in; **does not apply on Neon** | Every Neon role for a direct connection carries non-revocable BYPASSRLS (§5.2). The base repository and the per-endpoint 404 test are the enforced layers; the RLS code stays, correct against self-hosted Postgres. |
| Weather storage | **Shared server-side cache keyed by location grid** | Under a real backend, farmers near each other share a forecast. Removes per-tenant weather rows entirely. |
| `crop.name` vs catalog | **`crop_catalog_id` FK + optional `crop.label`** | Species is reference data; the farmer's own nickname ("North plot soy") is not. |
| RBAC tables | **Out of v1** | `farmer.user_role` is free text nothing reads. Shipping unused permission tables adds schema without behaviour. |

---

## 2. Architecture

```
Browser — Angular 20 PWA (GitHub Pages, static)
   │
   │   phone + PIN ──▶ POST /api/v1/auth/session ──▶ session JWT (HS256, ~24h)
   │
   │   Authorization: Bearer <session JWT>   (a Firebase ID token also works)
   ▼
FastAPI  (Render · Singapore)
   │   decode JWT / verify_id_token() · Pydantic validation · tenant scoping · business rules
   ├──────────────▶ Cloudflare R2          [attachment blobs] [Stage 6]
   ├──────────────▶ OpenWeatherMap         [server holds the API key] [Stage 6]
   ▼
SQLAlchemy 2.0 async + asyncpg
   ▼
Neon Postgres (Singapore · pooled)
```

This is the target architecture; §10 tracks what is built (Stages 1–5 done). Cloudflare R2 and the server-side OpenWeatherMap key are Stage 6, not started.

The client is **online-only**. Every mutation is one API call, serialized
through a FIFO queue in `ApiStorageService` so a crop's POST lands before its
activities' POSTs. The browser stores only the session keys; every load reads
from the API.

---

## 3. Hosting and the free tier

Figures verified **September 2026**; re-verify at Stage 2.

### 3.1 Database — Neon

| | **Neon** | Supabase |
|---|---|---|
| Storage | 0.5 GB / project | 500 MB |
| Projects | up to 100 | 2 |
| Compute | 100 CU-hours/mo, autoscale to 2 CU | — |
| Idle | **scale-to-zero, wakes on connection** | **pauses after 1 week idle, manual unpause** (tightened Feb 2026) |
| Nearest region | **Singapore** (no India region) | Singapore |
| Card / expiry | none / never expires / commercial use OK | none |

Supabase is ruled out by the **idle pause**, not by its limits. This is a
seasonal app — quiet fortnights between sowing and harvest are normal, and a
farmer returning to a dead app that needs a dashboard login is not a
product.

### 3.2 API host — Render

| | **Render** | Koyeb | Fly.io |
|---|---|---|---|
| Free instance | 512 MB, 0.1 CPU | 512 MB, 0.1 vCPU | **no free tier for new signups** |
| Allowance | 750 instance-h / workspace / month | 1 instance per org | — |
| Idle | spins down at 15 min, **~1 min cold start** | scale-to-zero at 1 h | — |
| Regions | Oregon, Ohio, Virginia, Frankfurt, **Singapore** | **Frankfurt / Washington DC only** | — |

Koyeb cannot run in Asia on the free plan, which is disqualifying for an
India-facing app. Render and Neon both in Singapore keeps API↔DB latency
inside one region.

**Provisioned as a native Python service, not the Dockerfile.** Render's
service-creation API has no Docker/container-registry path — only
buildpack-style runtimes with an explicit build and start command. The live
service (`myfarm-api`, `srv-dafrtrn40ujc73cmjpog`) runs
`pip install ./projects/backend` and
`uvicorn myfarm_api.main:app --host 0.0.0.0 --port $PORT` directly, no image
involved. `projects/backend/Dockerfile` still exists and CI still builds it
(§9) as a parity check. The two are deliberately kept in step — both do
`pip install .` then `alembic upgrade head && uvicorn …` — and `render.yaml`
pins the buildpack side. The residual risk is an OS-package dependency the
buildpack lacks but the slim image has; the CI build would still pass. If
that ever bites, the fix is Render's non-API Docker path or retiring the
Dockerfile in favour of the buildpack build CI already exercises.

### 3.3 Why a one-minute cold start is acceptable

The app is **online-only**, so cold starts are now user-visible. Acceptable
because (1) typical sessions are short bursts on a mobile device where one
load is not a dealbreaker; (2) seasonal workload with quiet periods between
harvest and sowing means cold starts don't happen on every use; (3) Neon's
scale-to-zero saves cost far more than paying for a warm instance costs; (4)
this is the cheapest path to get a working backend and infrastructure in
production.

If higher availability becomes critical, the API host moves to a paid tier
(Render's paid plans, or Fly.io with a reserved instance).

### 3.4 Ceilings and responses

| Ceiling | Trigger | Response |
|---|---|---|
| Neon 0.5 GB | ~1–2 M activity rows; attachments would blow it instantly | Blobs live in R2; Postgres stores only `storage_key` |
| Neon 100 CU-h | Sustained traffic or a query keeping compute awake | Scale-to-zero, indexed queries; Launch tier $19/mo |
| Render 750 h | One always-on service ≈730 h — fits, but only one | A second service forces a paid plan |
| 0.1 CPU / 512 MB | Concurrency, not throughput | Single worker, fully async, no blocking calls |

---

## 4. Backend stack and layout

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Python **3.12** | — |
| Framework | **FastAPI** + Uvicorn, 1 worker | Async |
| ORM | **SQLAlchemy 2.0 async** | Typed; async so 0.1 CPU is never blocked on I/O |
| Driver | **asyncpg** | Fastest async Postgres driver |
| Migrations | **Alembic** | Autogenerated, hand-reviewed |
| Schemas | **Pydantic v2** | Validation and the OpenAPI contract |
| Auth | **PyJWT** (HS256 session tokens) + **firebase-admin** (fallback `verify_id_token()`); PINs hashed with stdlib `hashlib.pbkdf2_hmac` | §5.1 |
| Object storage | **boto3** (S3 API) | R2 is S3-compatible |
| Tests | **pytest** + `httpx.AsyncClient` + Postgres service container | Real Postgres, never SQLite |
| Lint/format/types | **ruff** + **mypy** | Mirrors the frontend's eslint/prettier gate |

**Pooling is mandatory.** Use Neon's `-pooler` endpoint with
`pool_size=5, max_overflow=0, pool_pre_ping=True` — a 0.1-CPU instance cannot
use more, and `pool_pre_ping` absorbs connections dropped while the database
was scaled to zero.

```
projects/
  home/                        existing Angular app
  shared/                      existing Angular library
  backend/                     Python project root — own venv, deps, tooling
    pyproject.toml             dependencies · ruff · mypy config
    Dockerfile
    alembic.ini
    migrations/versions/       migration history (tooling, not library code)
    myfarm_api/                the importable package
      main.py                  app, CORS, lifespan
      core/      config.py · security.py (PIN hash, session JWT, token dep) · db.py
      models.py                SQLAlchemy — schema source of truth
      schemas/                 Pydantic request/response
      repositories/base.py     tenant scoping enforced here (§5.2)
      routers/   farmers · farms · lands · crops · activities · expenses · weather
      services/                business rules, derived fields
    tests/
```

Every deliverable sits under `projects/`, one directory per project —
`home` and `shared` are the Angular pair, `backend` is the service.

### 4.1 Tooling-collision guard

**This is safe, with one guard.** `angular.json` lists its projects
explicitly (`home`, `shared`) and does no directory discovery, so the CLI
ignores `projects/backend/` entirely; `ng build` and `ng test` never look at
it. The `lint` script globs `projects/**/*.ts`, which no `.py` file matches.

The one real collision is **`format:check`**, which globs
`projects/**/*.{ts,html,scss}` — any `.html` that ever lands in the backend
(a Jinja template, a coverage report) would be pulled into Prettier's check
and fail CI. There is no `.prettierignore` today, so **Stage 2 adds one**
covering `projects/backend/`. Narrowing the two globs to
`projects/{home,shared}/**` works equally well; the ignore file is less
likely to be forgotten when a third Angular project appears.

Two naming choices worth stating, since they are easy to get wrong later:

- **`backend/`, not `api/`** — the directory holds the data layer,
  migrations, business services and tests, not only HTTP routes. It also
  leaves room for a second deployable (a scheduled weather refresher, say)
  without the name reading wrongly.
- **`myfarm_api/`, not `app/`** — imports read `from myfarm_api.models import
  Farmer`, which is self-describing in tracebacks and test output. `app` is
  the FastAPI tutorial default and says nothing about whose app it is.

`pyproject.toml` stays inside `projects/backend/` rather than at the repo
root: the root already carries `package.json`, `tsconfig.json` and
`eslint.config.js` for the JS side, and the two toolchains should not have to
share a directory.

---

## 5. Authentication and tenancy

### 5.1 Flow (issues #45, #50)

1. **Sign in / register** — the login screen sends `{phone, pin}` to
   `POST /api/v1/auth/session`. The backend looks the farmer up by phone,
   verifies the PIN against a stored PBKDF2-SHA256 hash, and returns a
   **session JWT** (HS256, `sub` = the farmer's `auth_uid`, ~24h, signed
   with `SESSION_JWT_SECRET`). A `404` means "no such phone" → the screen
   collects a name and calls `POST /api/v1/auth/register`; a `401` means a
   wrong PIN. PIN accounts get a stable `auth_uid` of `pin:<uuid7>`.
2. **This is online-only.** An identity can't be minted offline and
   reconciled later (phone uniqueness and the JWT are server-only, and
   there's no OTP to prove ownership on merge), so a network failure asks
   the user to retry and creates nothing locally. Once signed in, the JWT
   sits in `localStorage` (~24h). It and two small session keys are the only
   things the app keeps in the browser; all farm data is read from the API.
3. **Every API request** — carries `Authorization: Bearer <session JWT>`.
4. The FastAPI dependency decodes and validates the JWT (`sub`, `exp`,
   `iss`) — or, if the token isn't ours, falls back to
   `firebase_admin.auth.verify_id_token()` — then fetches/creates the
   farmer row (just-in-time provisioning).
5. Request carries `CurrentFarmer` holding the internal UUIDv7 `id`.

**Firebase phone OTP is deferred, not gone.** The Admin SDK stays in the
backend as the fallback token verifier, and when OTP is added it's a
phone-verify step that runs *before* step 1 issues the same JWT — no
rewrite of anything downstream.

### 5.2 Tenant isolation — the top risk

Firestore rules made cross-tenant access impossible **at the database**.
That guarantee is gone. A single missing `WHERE farmer_id = :id` is a
cross-farmer data leak, and it passes every happy-path test.

Three layers were designed in; only two hold on Neon as deployed:

1. **A base repository that cannot be constructed unscoped.** It takes
   `farmer_id` and injects the predicate into every query. Routers never
   write raw filters.
2. ~~Postgres Row-Level Security~~ — **does not apply on Neon.** Confirmed
   against the provisioned project (`round-cake-95874663`): every role Neon
   lets you create for a direct connection is a member of `neon_superuser`
   and carries `BYPASSRLS`, and neither is revocable (`ALTER ROLE ...
   NOBYPASSRLS` and `REVOKE neon_superuser FROM ...` both fail with
   "permission denied," even from a `CREATEROLE` role). A `BYPASSRLS` role
   skips RLS unconditionally, `FORCE ROW LEVEL SECURITY` included. This is a
   platform property of connecting directly, not a misconfiguration —
   Neon's own hosted Data API gets non-bypassing roles for its own use, but
   nothing exposed to a directly-connecting service does. `set_rls_farmer()`
   and `tests/test_rls.py` stay in the codebase (correct against
   self-hosted Postgres, and worth having if the database ever moves), but
   carry no weight in production today.
3. **A cross-tenant test per endpoint** — farmer A requests farmer B's row
   and must receive **404**, not 403 (403 confirms the row exists). Was
   already a merge requirement; with layer 2 gone, it's the only thing
   standing between a repository bug and a real leak, and Stage 3 should
   treat it accordingly.

No endpoint accepts a farmer id in its path or body. Tenancy comes from the
token, only.

---

## 6. Data model

Normalised to 3NF. SQLAlchemy models are the source of truth; Alembic
generates migrations.

### 6.1 Tables

**Reference (seeded):** `crop_catalog` · `expense_category` · `activity_type`

| Table | Key columns |
|---|---|
| `farmer` | `id` uuid PK · `auth_uid` varchar(128) UNIQUE · `phone` UNIQUE · `full_name` · `email` · `preferred_language` · `user_role` · `created_at` |
| `farm` | `id` PK · `farmer_id` FK · `name` · `area` · `area_unit` · `water_source` · `irrigation_type` · `farming_method` · `location_type` · `state` · `district` · `village` · `pincode` · `lat` · `lng` · `setup_completed` |
| `farm_crop` | `farm_id` FK + `crop_catalog_id` FK (composite PK) |
| `land` | `id` PK · `farmer_id` FK · `farm_id` FK · `name` · `area_sq_m` · `area_hectares` GENERATED · `area_acres` GENERATED · `notes` |
| `land_point` | `land_id` FK + `seq` (composite PK) · `lat` · `lng` |
| `crop` | `id` PK · `farmer_id` FK · `land_id` FK · `crop_catalog_id` FK · `label` NULL · `area` · `area_unit` · `season` · `sowing_date` · `current_stage` · `status` · `expected_harvest_date` |
| `activity` | `id` PK · `farmer_id` FK · `parent_activity_id` FK NULL · `crop_id` FK NULL · `land_id` FK NULL · `activity_type_id` FK · `custom_activity_name` NULL · **`date` NULL** · `season` · `status` · `notes` · `metadata` jsonb |
| `activity_expense` | `id` PK · `activity_id` FK · `expense_category_id` FK · `item_id` · `resource_id` · `quantity` · `unit` · `rate` · `amount` · `remarks` |
| `activity_attachment` | `id` PK · `activity_id` FK · `storage_key` · `content_type` · `size_bytes` |
| `weather_cache` | `id` PK · `grid_lat` · `grid_lng` (rounded, **UNIQUE together**) · `place_name` · `current` jsonb · `forecast` jsonb · `alerts` jsonb · `fetched_at` |

Every farmer-owned table also carries `created_at`, `updated_at`, and
`deleted_at` (§6.3).

### 6.2 Normalisation decisions

| Decision | Reason |
|---|---|
| `farmer` split from `farm` | Farm attributes describe a farm, not a person; also unblocks multi-farm accounts |
| `crop_catalog` / `expense_category` / `activity_type` lookups | Remove repeated free text |
| `land.geo_json` dropped | Fully redundant with `land_point`; regenerated on read |
| `area_hectares` / `area_acres` **GENERATED** | Transitive dependency on `area_sq_m` — keeps read speed without the 3NF violation |
| `crop.upcoming_activity` dropped | Derived — the crop's next scheduled activity |
| `activity.metadata` stays `jsonb` | Deliberate exception: 12 activity types with disjoint sparse fields; alternatives are 12 sparse tables or EAV |
| `status` / `stage` / `season` / `area_unit` stay `CHECK` | Code-coupled state machines whose truth is the TypeScript union |
| **Weather is one shared cache, not per farmer** | Neighbouring farmers share a forecast. Keyed by rounded lat/lng, TTL 30 min, no tenant column, no per-farmer rows |

`activity.date` is **nullable** — `Activity.date` is `date?: number`,
"undefined = not yet scheduled". Ids default to **UUIDv7** in native `uuid`
columns; `farmer.id` is UUIDv7 with `auth_uid` holding either a `pin:<uuid7>`
identifier (PIN accounts) or a Firebase uid.
Create endpoints are to accept a **client-supplied `id`**. The client mints
one with `crypto.randomUUID()` (v4), so a new record has its final id the
moment it appears in the UI and nothing is re-keyed after the save.
**Not built yet (#76):** the Create schemas have no `id` field, so the server
drops the client's id and mints its own, and the client never adopts the
server's.

### 6.3 Audit columns

| Column | Purpose |
|---|---|
| `updated_at timestamptz NOT NULL` | Last-modified time; list ordering, and the cursor key if pagination returns (#62) |
| `deleted_at timestamptz NULL` | **Soft delete.** Lists exclude these rows; a deleted row keeps its history and its foreign keys intact |

---

## 7. API design

`/api/v1/...` — REST, resource-per-entity, unpaginated (all rows per call).

```
GET    /api/v1/me                              current farmer (JIT-provisioned)
CRUD   /api/v1/farms | lands | crops | activities
GET    /api/v1/expenses                        all expenses for the farmer
CRUD   /api/v1/activities/{id}/expenses | attachments
GET    /api/v1/weather?lat=&lng=               server-cached, key never shipped
GET    /api/v1/reference/{crops|expense-categories|activity-types}
```

- **Per-entity CRUD only.** No endpoint can express a whole-collection
  replace.
- **Unpaginated.** Each list endpoint returns all rows for the farmer in a single call: `GET /api/v1/farms` returns `{ "items": [...] }`.
- **Errors** RFC 9457 `application/problem+json` — one shape for the client.
- **Attachments** upload via a short-lived R2 presigned URL; the API records
  only `storage_key`.
- **Land polygons** stored as `points: [{lat, lng}, ...]` on `LandCreate`/`LandUpdate`/`LandRead`; persisted to the `land_point` table.

---

## 8. Frontend API contract types

FastAPI still publishes OpenAPI from the Pydantic schemas, but the frontend
does **not** consume it. `projects/home/src/app/core/api/contracts/` holds
hand-written interface modules — one per resource — that state what the
frontend expects from each endpoint. They are authored when an endpoint is
built (issue #49).

```
SQLAlchemy models ──Alembic──▶ Postgres
        └── Pydantic ──▶ OpenAPI  (published; not consumed by the client)

projects/home/src/app/core/api/contracts/*.ts   ← hand-written, frontend-owned
```

Nothing generates or diff-checks these against the spec. Contract drift — a
renamed or newly-nullable backend field — is caught by the Playwright
golden-path E2E and on staging, not at build time. This is a deliberate
trade for keeping the frontend build fully decoupled from the backend.

---

## 9. CI/CD

| Pipeline | Steps |
|---|---|
| Frontend | unchanged — lint → format:check → test → build → GitHub Pages |
| Backend | ruff → mypy → pytest (Postgres service container) → build Docker image (parity check, §3.2) → **deploy** |
| Deploy | **CI-gated** (issue #41): Render `autoDeploy` is **off**; the backend workflow POSTs `RENDER_DEPLOY_HOOK_URL` only after the checks pass on a push to `main`. Service config pinned in `render.yaml`. |
| Migrations | `alembic upgrade head` runs as part of the service start command (free plan has no pre-deploy hook); idempotent, a no-op once current |
| Contract | frontend-owned API types are hand-maintained (§8) — no generation step |

Secrets: GitHub Actions and Render both hold the Neon URL,
`SESSION_JWT_SECRET`, the Firebase project id, and the R2 / OpenWeatherMap
keys as env vars. The existing `environment.prod.ts` stamping gains the API
base URL. The API allowlists the GitHub Pages origin for CORS.

---

## 10. Delivery stages

| Stage | Scope | Gate |
|---|---|---|
| **1 — Seam repair** | Per-entity CRUD on `IStorageService`; delete `getFarmers()`/`saveFarmers()`; still on localStorage | frontend Karma suite green (35 specs at time of writing) |
| **2 — API skeleton** | FastAPI app under `projects/backend/`; `.prettierignore` guard (§4.1); Neon + Render provisioned; `/health`; Firebase token dependency; base repository (RLS designed in, inert on Neon — §5.2); CI | CORS + token rejection proven; `format:check` still passes |
| **3 — Domain endpoints** | Models, Alembic migrations, CRUD routers, reference data | **Cross-tenant test per endpoint** |
| **4 — Client integration** | Frontend-owned API contract types (§8); `ApiStorageService`; **backend-issued PIN session JWT, online-only** (§5.1); `PATCH /me` | End-to-end online; wrong PIN → 401, unknown phone → 404; a tokenless request is rejected |
| **5 — Online-only data layer** (#61) | Unpaginated lists; `GET /expenses`; land polygons via `land_point`; client-supplied ids on create (#76); one API call per client mutation, FIFO-serialized; no browser data storage and no polling | A reload makes ~9 requests and none while idle; `localStorage` holds only the session keys |
| **6 — Weather + attachments** | Server-cached weather endpoint (retires the client-side key); R2 uploads | Key absent from the bundle |
| **7 — Firebase phone OTP (deferred)** | Add an OTP phone-verify step *before* `/auth/session` issues the JWT; nothing downstream changes | OTP gates registration; the same JWT and API contract are unchanged |

Stage 1 is deliberately first and separate: refactoring the seam *while*
introducing a network backend is how these migrations fail.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| **Cross-tenant leak** — one missing `farmer_id` predicate | §5.2 — RLS doesn't cover this on Neon; the repository plus the per-endpoint negative test are what's actually load-bearing |
| **Free-tier terms move** — verified Sept 2026 | Neon and Render projects both provisioned; only `DATABASE_URL` and the host change if a provider is swapped |
| Neon idles to zero mid-request | Pooled endpoint, `pool_pre_ping`, connection timeout handling |
| Render cold start degrades UX | Accepted for a seasonal, low-traffic app (§3.3); move the API to a paid instance if it becomes a real complaint |
| CI failing ships to production | Closed (issue #41): `autoDeploy` is off; the deploy hook fires only after ruff + mypy + pytest pass on `main` |
| 0.5 GB storage ceiling | Blobs in R2; weather is one shared cache; row-count alerting before the ceiling |
| Alembic autogenerate emits a destructive migration | Every migration hand-reviewed; CI runs it against a scratch database first |
| Session JWT signing key (`SESSION_JWT_SECRET`) leaks | Short TTL (~24h); rotating the secret invalidates every live session; the PIN hash (PBKDF2-SHA256) is never exposed. Firebase remains wired as an alternative verifier if the HS256 scheme needs replacing. |

---

## 12. Verification

- **Stage 1** — the existing frontend Karma suite (35 specs at time of writing) stays green through the interface change.
- **Stage 2** — `/health` reachable from the GitHub Pages origin (proves
  CORS); forged and expired tokens are rejected.
- **Stage 3** — pytest against real Postgres; **every endpoint has a
  cross-tenant test returning 404**; Alembic up/down runs clean.
- **Stage 4** — sign in with phone + PIN against the live API, get a JWT, `GET /api/v1/me` returns the farmer; wrong PIN → 401, unknown phone → 404; app works end to end online.
- **Stage 5** — a reload makes ~9 requests and none while idle; editing an
  activity sends one PATCH; a drawn land polygon survives a reload;
  `localStorage` holds only the session keys.
- **Stage 6** — grep the built bundle to confirm no OpenWeatherMap key.
- **Stage 7 (deferred)** — an OTP phone-verify step runs before `/auth/session` issues the JWT; the token, the API contract, and every downstream flow are unchanged.
- Full gate: `ruff`, `mypy`, `pytest`, `npm run lint`, `format:check`,
  `test`, `build`.
