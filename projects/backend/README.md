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

### Render (API host) — still needs your action

Provisioning a Render service needs an account and connecting this GitHub
repository — I have no credentials for that and can't do it on your behalf.

1. Create an account at render.com, connect this GitHub repository, and
   create a **Web Service** rooted at `projects/backend/` using the
   `Dockerfile` in this directory, in the **Singapore** region, on the free
   instance type.
2. Set these environment variables on the service:
   - `DATABASE_URL` — the corrected Neon connection string above.
   - `FIREBASE_PROJECT_ID` — the Firebase project id (BACKEND_PLAN.md §5.1
     — this is a public identifier, not a secret; it's what `verify_id_token`
     checks the token's audience against).
   - `CORS_ORIGINS` — the GitHub Pages origin, e.g.
     `https://ramjawade.github.io`.
3. Render's health check path should be `/health`.

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
