# MyFarm Database Schema

This directory used to hold a hand-maintained, dual-backend schema mirror
(Firestore + a "future" Postgres SQL file). That plan was superseded — see
[`../BACKEND_PLAN.md`](../BACKEND_PLAN.md), the single canonical backend
plan. The backend is **FastAPI over Neon Postgres**; **Firebase Auth** is
retained for phone-OTP identity only (it verifies the ID token — it does not
store any application data). There is no Firestore anywhere in this codebase.

## Where the schema actually lives now

```
SQLAlchemy models ──Alembic──▶ Postgres
        └── Pydantic ──▶ OpenAPI ──openapi-typescript──▶ Angular types
```

| Concern | Source of truth |
|---|---|
| Table/column definitions | `projects/backend/myfarm_api/models.py` (SQLAlchemy 2.0) |
| Schema migrations | `projects/backend/migrations/versions/` (Alembic) |
| Request/response validation | `projects/backend/myfarm_api/schemas/` (Pydantic v2) |
| Frontend types | Generated from the FastAPI OpenAPI output via `openapi-typescript` — CI fails if generated types are stale |
| Full data model, normalisation rationale, and table list | [`../BACKEND_PLAN.md`](../BACKEND_PLAN.md) §6 |

There is no separate hand-maintained schema file to keep in sync — the
SQLAlchemy models are edited directly, Alembic generates the migration, and
everything downstream (Postgres DDL, the OpenAPI contract, the TS client
types) is generated from that one place. This intentionally replaces the
older "single TypeScript source feeding two backends" approach: with only
one backend (Postgres) there is nothing left to keep in sync manually.

## History

This directory previously documented a "Firebase Firestore now, Postgres
later" plan, including a Firestore collection layout, security rules,
composite indexes, and a localStorage → Firestore migration map. That
direction was superseded when [`BACKEND_PLAN.md`](../BACKEND_PLAN.md) settled
on FastAPI + Postgres for all application data, with Firebase Auth kept for
identity only. Those files have been removed as dead documentation; the real
localStorage → Postgres migration is documented in
[`../BACKEND_PLAN.md`](../BACKEND_PLAN.md) §10.

## RBAC

`farmer.user_role` is free text; no role/module tables exist. RBAC is
explicitly out of scope for v1 (`../BACKEND_PLAN.md` §1) — add it as a real
Alembic migration if/when it's needed, rather than a standing "optional"
schema file.
