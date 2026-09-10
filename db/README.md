# MyFarm Database Schema

This directory used to hold a hand-maintained, dual-backend schema mirror
(Firestore + a "future" Postgres SQL file). That plan was superseded — see
[`../BACKEND_PLAN.md`](../BACKEND_PLAN.md), the single canonical backend
plan. The backend is **FastAPI over Neon Postgres**. Identity is a
**backend-issued PIN session JWT** (online-only; `BACKEND_PLAN.md` §5.1);
`firebase-admin` stays in as a fallback token verifier for a future phone-OTP
step. There is no Firestore anywhere in this codebase.

## Where the schema actually lives now

```
SQLAlchemy models ──Alembic──▶ Postgres
        └── Pydantic ──▶ OpenAPI  (published; the frontend does not consume it)

projects/home/src/app/core/api/contracts/*.ts   ← hand-written, frontend-owned
```

| Concern | Source of truth |
|---|---|
| Table/column definitions | `projects/backend/myfarm_api/models.py` (SQLAlchemy 2.0) |
| Schema migrations | `projects/backend/migrations/versions/` (Alembic) |
| Request/response validation | `projects/backend/myfarm_api/schemas/` (Pydantic v2) |
| Frontend API types | Hand-written per-resource modules in `projects/home/src/app/core/api/contracts/` (issue #49) — not generated, not diff-checked against the spec; drift is caught by the Playwright golden-path E2E and staging |
| Full data model, normalisation rationale, and table list | [`../BACKEND_PLAN.md`](../BACKEND_PLAN.md) §6 |

On the backend side the SQLAlchemy models are the single source: they are
edited directly, Alembic generates the migration, and the Postgres DDL and
the OpenAPI document follow from that one place. The frontend keeps its own
hand-written view of the API (see [`../BACKEND_PLAN.md`](../BACKEND_PLAN.md)
§8) rather than importing generated types, so the two builds stay
decoupled.

## History

This directory previously documented a "Firebase Firestore now, Postgres
later" plan, including a Firestore collection layout, security rules,
composite indexes, and a localStorage → Firestore migration map. That
direction was superseded when [`BACKEND_PLAN.md`](../BACKEND_PLAN.md) settled
on FastAPI + Postgres for all application data, with Firebase Auth kept for
identity only. Those files have been removed as dead documentation. There is
no data-migration step — the app launches greenfield.

## RBAC

`farmer.user_role` is free text; no role/module tables exist. RBAC is
explicitly out of scope for v1 (`../BACKEND_PLAN.md` §1) — add it as a real
Alembic migration if/when it's needed, rather than a standing "optional"
schema file.
