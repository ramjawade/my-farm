# MyFarm — Project Status & Roadmap

This is the single status document for the project: what MyFarm is, what's
actually built today, and what's left. It replaces the earlier trail of
phase-by-phase planning docs (`PHASE_1_PLAN.md` through `PHASE_5_PLAN.md`,
`MVP_1_PLAN.md`, `implementation_plan.md`) now that their work has landed —
that history lives in git, not as files to read through here. Update this
doc whenever real status changes; it should stay the one place that tells
you what's real.

## 1. What MyFarm is

A farm-management web app for Indian smallholder farmers: register a farm,
draw its lands on a map, track crops through their lifecycle, log field
activities and expenses, check weather, and run season expense reports.
Angular 20 (standalone components, signals) as an `ng-workspace` with
`home` (the app) and `shared` (a component library — confirm dialog, toast).
Installable as a PWA. A Python/FastAPI backend now sits behind it.

## 2. Architecture today

```
Angular 20 PWA (GitHub Pages, static)
   │
   │   phone + PIN ──▶ POST /api/v1/auth/session ──▶ session JWT (HS256, ~24h, online-only)
   │
   │   Authorization: Bearer <session JWT>
   ▼
FastAPI  (Render · Singapore)
   │   decode JWT (or verify_id_token fallback) · Pydantic validation · tenant-scoped repository
   ├──────────────▶ OpenWeatherMap   [server holds the key — Stage 6, not yet wired]
   ▼
SQLAlchemy 2.0 async + asyncpg
   ▼
Neon Postgres (Singapore · pooled)
```

Client writes are **online-only** — each mutation is a single API call. Full
architecture, every table, every decision and its reasoning:
**[`BACKEND_PLAN.md`](./BACKEND_PLAN.md)** (canonical, kept current — update
it, not this section, when the backend changes). Visual counterpart: the
[MyFarm Data Architecture canvas](https://claude.ai/code/artifact/261b1e80-742d-4e4a-9bc3-90bcbe29da40)
(source in `design/database-schema/`).

## 3. Completed

**Frontend foundation**
- One unified `Activity` + `ActivityExpense` model (typed `ActivityType`,
  `ActivityStatus`, `metadata`) — the old duplicate `ActivityEntity` is gone
  from the crop-timeline models.
- `IStorageService` is the single persistence boundary — activities,
  expenses, crops, lands, farmer profiles, weather — implemented by
  `ApiStorageService` against the backend. No feature talks to
  `localStorage`; only `AuthService` keeps the session keys there.
- PIN auth (`AuthService`, `authGuard`) gates every route. Sign-in is a
  single online `POST /api/v1/auth/session` that returns a session JWT
  (`SessionAuthService`); there is no offline sign-in. Firebase phone OTP is
  a deferred add-on (a verify step before the same JWT) — Backend Stage 7.
- Live weather (OpenWeatherMap), 30-min cache, 4-tier fallback
  (API → cache → mock → error), farming advisories, severe-weather alerts.
  Key is currently a CI-injected, origin-restricted client key (see
  `WEATHER_API_SETUP.md`) — moving it fully server-side is Backend Stage 6.

**MVP1 — client-presentable prototype** (full findings/decisions history:
git log for `claude/mvp1-*` branches)
- Onboarding checklist with empty states. (The demo dataset and JSON
  backup/restore that shipped with MVP1 were removed in #61.)
- Toast notifications, confirm-on-delete everywhere, wildcard route +
  `NotFoundComponent`, sidebar IA, real dashboard KPIs (fabricated marketing
  numbers removed).
- Reports page: expenses by crop/category/month, CSV export.
- Land ↔ crop ↔ activity cross-linking (cost roll-ups on crop/land detail).
- PWA: manifest, icons, service worker (`ngsw-config.json`).
- **Not done**: the Playwright golden-path smoke test (CI `e2e` job) from
  the original plan was never added — the golden path is currently only
  exercised by hand, per `DEMO_SCRIPT.md`.

**Backend — Stages 1–5 of 7** (canonical plan and stage gates:
`BACKEND_PLAN.md` §10)
- Stage 1 — Storage seam repaired to per-entity CRUD ahead of the network swap.
- Stage 2 — FastAPI skeleton on Render; Firebase token verification; Neon
  provisioned; tenant-scoped base repository.
- Stage 3 — SQLAlchemy models, Alembic migrations, CRUD routers (farmers,
  farms, lands, crops, activities, expenses, attachments), reference data,
  a cross-tenant 404 test on every endpoint.
- Stage 4 — Generated TS types from the OpenAPI contract; `ApiStorageService`
  wired in behind `IStorageService`; online-only at this point.
- Stage 5 — Online-only data layer (#61): unpaginated lists, `GET /expenses`,
  land polygons stored on the backend, one API call per change, no browser
  data storage and no polling.

## 4. Remaining work

- **Backend Stage 6 — Weather + attachments (#42).** Move the OpenWeatherMap
  key server-side (shared cache keyed by location grid, not per farmer); wire
  Cloudflare R2 for activity photo attachments (currently disabled in the UI).
- **Backend Stage 7 — Firebase phone OTP (deferred).** Add an OTP
  phone-verify step *before* `/api/v1/auth/session` issues the JWT. The
  token, the API contract and every downstream flow stay unchanged. Plan:
  BACKEND_PLAN.md §5.1.
- **Pagination (#62, not scheduled).** Lists return every row today; add
  cursor pagination once a farmer's lists grow to a few hundred rows.
- **E2E smoke test.** Add the Playwright golden-path spec against mobile +
  desktop viewports, gated in CI on PRs (the one MVP1 item that didn't land).
- **Known gaps carried forward from `BACKEND_PLAN.md` §11**, worth closing
  before they bite:
  - Render runs a native buildpack build, not the `Dockerfile` CI verifies —
    the two can drift silently (§3.2).
  - Postgres RLS does not apply on Neon's hosted roles (confirmed, not a
    misconfiguration); tenant isolation is enforced by the base repository
    and the per-endpoint cross-tenant test only — treat any new endpoint's
    404 test as load-bearing, not a formality.

## 5. Where things live

| Concern | Doc |
|---|---|
| Backend architecture, data model, API, sync protocol, delivery stages | [`BACKEND_PLAN.md`](./BACKEND_PLAN.md) |
| Visual schema / architecture / flow diagrams | [`design/database-schema/`](./design/database-schema/) → [published canvas](https://claude.ai/code/artifact/261b1e80-742d-4e4a-9bc3-90bcbe29da40) |
| Weather API key setup | [`WEATHER_API_SETUP.md`](./WEATHER_API_SETUP.md) |
| Manual demo walkthrough | [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) |
| Backend service README (local dev, endpoints) | [`projects/backend/README.md`](./projects/backend/README.md) |
| Land-drawing UX exploration | [`design/land-section-ux/`](./design/land-section-ux/) |
| Day-to-day workflow rules (branching, CI gates, model stages) | [`CLAUDE.md`](./CLAUDE.md) |

## 6. Superseded / removed

- `PHASE_1_PLAN.md`, `PHASE_2_PLAN.md`, `PHASE_4_PLAN.md` — unify activity
  model, persistence abstraction, live weather. All complete; folded into
  §3 above. Removed as files — see git history for the original plans.
- `PHASE_5_PLAN.md` — the original Firestore-backed plan. Superseded by
  `BACKEND_PLAN.md` (FastAPI + Postgres) before implementation began on it.
  Removed as a file; `db/README.md` and `.diagram/er.md` carry the same
  pointer for anyone who lands there from an old link.
- `MVP_1_PLAN.md` — client-presentable prototype plan. Implemented (§3);
  removed as a file now that it's status, not a plan.
- `implementation_plan.md` — the original farm-activity module plan,
  predating the unified activity model. Long superseded; removed.
