# MyFarm API

FastAPI over PostgreSQL, Firebase Auth for identity. See
[`BACKEND_PLAN.md`](../../BACKEND_PLAN.md) at the repo root for the full
design; this is Stage 2 (API skeleton) of that plan's delivery stages.

## What exists after Stage 2

- `GET /health` — unauthenticated liveness check.
- `GET /api/v1/auth/whoami` — proves the Firebase token dependency: rejects
  a missing/malformed/expired/revoked/wrong-audience token with 401
  (`application/problem+json`), and returns the verified `uid` for a real
  one. Stage 3's `GET /api/v1/me` builds on this once the `farmer` table
  exists.
- `TenantScopedRepository` (`myfarm_api/repositories/base.py`) — the base
  every farmer-owned table's repository will extend. Cannot be constructed
  without a `farmer_id`; every method applies it automatically.
- `set_rls_farmer()` (`myfarm_api/core/db.py`) — sets the Postgres session
  variable a Row-Level Security policy reads. No farmer-owned tables exist
  yet to attach a policy to (Stage 3), but the mechanism is proven in
  `tests/test_rls.py` against a throwaway table and a real non-superuser
  role, independent of the application-level filter.

No models, no migrations, no `/api/v1/me` — those are Stage 3, once there's
a `farmer` table to build them against.

## What exists after Stage 3 (CRUD endpoints & cross-tenant tests)

### Core domain endpoints

All farmer-owned endpoints require Firebase token verification and use JIT farmer
provisioning (`/api/v1/me`). All return 404 (never 403) for cross-tenant access
attempts. List endpoints return all rows for the farmer in a single call.

**Farmer profile:**
- `GET /api/v1/me` — get or provision current farmer (JIT)

**Farms (top-level entity):**
- `GET /api/v1/farms` — list all farms for current farmer
- `GET /api/v1/farms/{farm_id}` — get single farm
- `POST /api/v1/farms` — create farm
- `PATCH /api/v1/farms/{farm_id}` — update farm
- `DELETE /api/v1/farms/{farm_id}` — soft-delete farm

**Lands (plots within a farm):**
- `GET /api/v1/lands` — list all lands for current farmer
- `GET /api/v1/lands/{land_id}` — get single land
- `POST /api/v1/lands` — create land
- `PATCH /api/v1/lands/{land_id}` — update land
- `DELETE /api/v1/lands/{land_id}` — soft-delete land

**Crops (plantings on a land):**
- `GET /api/v1/crops` — list all crops for current farmer
- `GET /api/v1/crops/{crop_id}` — get single crop
- `POST /api/v1/crops` — create crop
- `PATCH /api/v1/crops/{crop_id}` — update crop
- `DELETE /api/v1/crops/{crop_id}` — soft-delete crop

**Activities (farm operations):**
- `GET /api/v1/activities` — list all activities for current farmer
- `GET /api/v1/expenses` — list all expenses for current farmer
- `GET /api/v1/activities/{activity_id}` — get single activity
- `POST /api/v1/activities` — create activity
- `PATCH /api/v1/activities/{activity_id}` — update activity
- `DELETE /api/v1/activities/{activity_id}` — soft-delete activity

**Nested: Activity Expenses:**
- `GET /api/v1/activities/{activity_id}/expenses` — list expenses for activity
- `POST /api/v1/activities/{activity_id}/expenses` — add expense to activity
- `PATCH /api/v1/activities/{activity_id}/expenses/{expense_id}` — update expense
- `DELETE /api/v1/activities/{activity_id}/expenses/{expense_id}` — delete expense

**Nested: Activity Attachments:**
- `GET /api/v1/activities/{activity_id}/attachments` — list attachments for activity
- `POST /api/v1/activities/{activity_id}/attachments` — add attachment to activity
- `DELETE /api/v1/activities/{activity_id}/attachments/{attachment_id}` — delete attachment

### Reference data endpoints (unauthenticated, shared across farmers)

**Crops catalog:**
- `GET /api/v1/reference/crops` — list crop species

**Expense categories:**
- `GET /api/v1/reference/expense-categories` — list expense types

**Activity types:**
- `GET /api/v1/reference/activity-types` — list activity types

### Admin endpoints

**Data initialization:**
- `POST /api/v1/admin/seed-reference-data` — seed crops, expenses, and activity types (idempotent)

### Technical details

- **Tenant isolation:** Three-layer defense per BACKEND_PLAN.md §5.2:
  1. App-level filtering in `TenantScopedCRUD[T]` repository
  2. Postgres RLS (unavailable on Neon, see limitation below)
  3. Cross-tenant tests verify every endpoint (load-bearing on Neon)

- **Soft-delete:** All farmer-owned entities exclude `deleted_at IS NOT NULL` rows.
  Hard deletes never used.

- **Error responses:** RFC 9457 `application/problem+json` format with HTTP status code.

- **Test coverage:** Each endpoint has 3+ cross-tenant tests (create/list, isolation,
  update/delete) — 30+ test cases across all entities.

## What exists after Stages 4–5 (client integration, online-only data layer)

`ApiStorageService`
(`projects/home/src/app/core/api/`) implements the Angular app's
`IStorageService` against these endpoints. Key design decisions:

- **Online-only:** Each mutation is a single API call with no local
  queueing. Writes serialize via a FIFO queue to prevent foreign-key races
  (e.g., a crop POST must complete before activity POSTs reference it).
- **Ids:** the server mints UUIDv7 ids. The client also mints its own with
  `crypto.randomUUID()`, but the Create schemas have no `id` field, so the
  server drops it — accepting it is still open (`BACKEND_PLAN.md` §6.1).
- **Land polygons:** `POST /api/v1/lands` and `PATCH /api/v1/lands/{id}`
  accept `points: [{lat, lng}, ...]` and persist to the `land_point` table;
  `GET /api/v1/lands` returns them back.
- `Activity.type` / `CropEntity.cropType` / `ActivityExpense.category` are
  free-text unions on the client but FK ids on the backend;
  `ReferenceDataService` resolves between the two by exact name match, so
  `admin.py`'s `SEED_*` lists must stay byte-identical to the frontend's
  `ACTIVITY_TYPE_LABELS` keys, `EXPENSE_CATEGORIES`, and
  `crop-timeline.component.ts`'s `cropNameOptions`.

Also: `Land.farm_id` is required, but the Angular app has no concept of
the top-level `Farm` — `ApiStorageService.getOrCreateDefaultFarmId()`
provisions one default Farm per farmer automatically (name "My Farm").

## Neon: provisioned

Project `my-farm` (id `round-cake-95874663`) exists in **Singapore**
(`aws-ap-southeast-1`), database `myfarm`, default role `myfarm_app`. Two
things worth knowing before using it:

**The connection string needs a small fix for asyncpg.** Neon's console
gives you `...?channel_binding=require&sslmode=require` — both are
libpq/psycopg conventions asyncpg doesn't parse the same way
(`channel_binding` isn't a recognized asyncpg connect argument at all, and
`sslmode` isn't either). Drop `channel_binding` and change `sslmode=require`
to `ssl=require`:

```
postgresql+asyncpg://myfarm_app:<password>@ep-calm-glade-b31ecycf-pooler.c-4.ap-southeast-1.aws.neon.tech/myfarm?ssl=require
```

Set that (with the real password from the Neon console — Settings →
Connection Details) as `DATABASE_URL` wherever the app runs. It's a secret;
this repo never commits it.

**Row-Level Security cannot be a real defense layer here — Neon-specific,
confirmed, not a configuration mistake to fix.** Every role Neon lets you
create for a direct connection is added to `neon_superuser` and carries
`BYPASSRLS`, and neither can be revoked — `ALTER ROLE ... NOBYPASSRLS` and
`REVOKE neon_superuser FROM ...` both fail with "permission denied," even
from a role with `CREATEROLE`. Postgres superusers and `BYPASSRLS` roles
skip Row-Level Security unconditionally, regardless of `FORCE ROW LEVEL
SECURITY` — so on Neon, a service connecting directly (not through Neon's
separate hosted Data API, which provisions its own non-bypassing roles for
its own use) gets no RLS enforcement no matter how the policies are
written. `set_rls_farmer()` and `tests/test_rls.py` still exist and still
pass — they're correct against real self-hosted Postgres and worth keeping
for a future migration off Neon — but **layer 2 of BACKEND_PLAN.md §5.2's
three-layer tenant isolation does not hold on this database as deployed.**
Layers 1 (`TenantScopedRepository`) and 3 (a cross-tenant test per
endpoint) are load-bearing here; Stage 3 should treat endpoint tests as
non-negotiable, not a nice-to-have, because they're what's actually
standing in for layer 2 on this platform.

### Render: provisioned

Web service `myfarm-api` (id `srv-dafrtrn40ujc73cmjpog`) is live at
<https://myfarm-api.onrender.com>, **Singapore** region, free instance.
Configuration is pinned in [`../../render.yaml`](../../render.yaml):
`rootDir: projects/backend`, `buildCommand: pip install .`,
`startCommand: alembic upgrade head && uvicorn myfarm_api.main:app …`,
`healthCheckPath: /health`.

```bash
curl https://myfarm-api.onrender.com/health
```

**Deploys are CI-gated (issue #41).** `autoDeploy` is **off**;
`.github/workflows/backend.yml` POSTs `RENDER_DEPLOY_HOOK_URL` after ruff +
mypy + pytest pass on a push to `main`. Migrations run in the start command,
so a deploy brings the Neon schema to head automatically.

Environment variables on the service: `DATABASE_URL` (Neon pooled,
`postgresql+asyncpg://…`), `SESSION_JWT_SECRET` (HS256 signing key),
`CORS_ORIGINS=https://ramjawade.github.io`, and `FIREBASE_PROJECT_ID` —
`""` is fine; the PIN session-JWT path doesn't use Firebase. Firebase is
only the fallback token verifier for a future OTP step (`BACKEND_PLAN.md`
§5.1).

**Your action:** create the deploy hook (dashboard → myfarm-api → Settings →
Deploy Hook) and add its URL as the `RENDER_DEPLOY_HOOK_URL` GitHub Actions
secret. Until then the deploy step logs a warning and skips.

### Firebase Auth — still needs your action

A Firebase project with phone-number sign-in enabled is required for real
tokens to verify against. This app's backend only ever *verifies* tokens —
it never calls the Admin SDK's privileged APIs — so it needs the project id
only, never a service-account key (see `core/security.py`'s
`_UnauthenticatedCredential` for why).

## Running locally

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# A local Postgres (not Neon) is enough for local dev and for every test in
# this directory — nothing here talks to Neon-specific features.
createdb myfarm_test

export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/myfarm_test"
export FIREBASE_PROJECT_ID="myfarm-dev"
export CORS_ORIGINS="http://localhost:4200"

uvicorn myfarm_api.main:app --reload
```

## Testing

```bash
ruff check .
mypy myfarm_api tests
pytest -q
```

`tests/test_rls.py` needs a non-superuser Postgres role to prove Row-Level
Security actually applies — Postgres superusers bypass RLS unconditionally,
so a test run as the connecting superuser would pass whether or not the
policy did anything. The test suite creates this role itself
(`myfarm_app`/`myfarm_app`) if it doesn't already exist; no manual setup is
required locally or in CI.
