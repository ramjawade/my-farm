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

## What I could not do: provision Neon and Render

Provisioning a Neon project and a Render service each need an account,
sign-up, and (for Render) connecting this GitHub repository — actions on
infrastructure I have no credentials for and cannot take on your behalf.
This section is the runbook for doing that; the code above already reads
its configuration from environment variables, so nothing changes once it's
done.

### 1. Neon (Postgres)

1. Create an account at neon.tech, then a project in the **Singapore**
   region — the closest free region to India, and the same region Render
   should be provisioned in (BACKEND_PLAN.md §3.2: keeping API↔DB traffic
   in one region matters for latency).
2. From the project dashboard, copy the **pooled** connection string (the
   one with `-pooler` in the hostname) — the unpooled one will exhaust
   connections fast against a 0.1-CPU API instance.
3. Convert its scheme from `postgresql://` to `postgresql+asyncpg://` (the
   driver `core/db.py` expects) and set it as `DATABASE_URL`.

### 2. Render (API host)

1. Create an account at render.com, connect this GitHub repository, and
   create a **Web Service** rooted at `projects/backend/` using the
   `Dockerfile` in this directory, in the **Singapore** region, on the free
   instance type.
2. Set these environment variables on the service:
   - `DATABASE_URL` — from step 1.
   - `FIREBASE_PROJECT_ID` — the Firebase project id (BACKEND_PLAN.md §5.1
     — this is a public identifier, not a secret; it's what `verify_id_token`
     checks the token's audience against).
   - `CORS_ORIGINS` — the GitHub Pages origin, e.g.
     `https://ramjawade.github.io`.
3. Render's health check path should be `/health`.

### 3. Firebase Auth

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
