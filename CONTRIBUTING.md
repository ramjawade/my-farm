# Contributing

Canonical plans: [`BACKEND_PLAN.md`](./BACKEND_PLAN.md) (backend) and
[`ROADMAP.md`](./ROADMAP.md). Work is tracked on the GitHub Project board —
see [`CLAUDE.md`](./CLAUDE.md) for the board-first workflow.

## Gates

| Area | Commands |
|---|---|
| Frontend | `npm run lint` · `npm run format:check` · `npm test` · `npm run build` |
| Backend  | `ruff check .` · `mypy myfarm_api tests` · `pytest -q` (from `projects/backend/`) |

Both run in CI on every PR. The backend job also builds `projects/backend/Dockerfile`
as a parity check and, on a green push to `main`, triggers the Render deploy
(issue #41).

## Backend: tenant isolation is test-enforced, not database-enforced

Postgres Row-Level Security **does not apply on Neon's hosted roles**
(confirmed, not a misconfiguration — `BACKEND_PLAN.md` §5.2). The only things
keeping one farmer's data away from another are:

1. the `farmer_id` predicate in `repositories/` (`TenantScopedRepository`), and
2. **a per-endpoint cross-tenant test** proving farmer B gets a 404 for
   farmer A's row.

**Every new farmer-scoped endpoint must ship with that 404 cross-tenant
test** (see `tests/test_endpoints_*.py` for the pattern). A new endpoint
without one is a data-leak waiting to happen, and review should block on it.

## Deploys

- **Frontend** → GitHub Pages, via `.github/workflows/deploy.yml` on green `main`.
- **Backend** → Render (`myfarm-api`, Singapore), **CI-gated**: `autoDeploy`
  is off; `.github/workflows/backend.yml` POSTs `RENDER_DEPLOY_HOOK_URL`
  after the checks pass on `main`. Service config is pinned in
  [`render.yaml`](./render.yaml). Migrations run as part of the start
  command (`alembic upgrade head`).
