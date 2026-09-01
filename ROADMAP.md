# MyFarm — Product Roadmap

This document exists because the project grew feature-by-feature without a shared
plan: modules were added in isolated sessions ("new moduels" x3 in the git log),
each solving its own slice without checking what the previous one built. This is
the map back to one coherent product. Update it whenever priorities change —
it should stay the single source of truth for "what are we building and why."

## 1. What MyFarm is

A farm-management web app for Indian smallholder farmers: register a farm, draw
its fields on a map, track crops through their lifecycle, log field activities
and expenses, and check weather/soil conditions. Built with Angular 20
(standalone components, signals) as an `ng-workspace` with two projects:
`home` (the app) and `shared` (a component library, currently just a confirm
dialog).

## 2. Current state — what's real vs. what's a facade

Being blunt about this is the point of the exercise; you can't sequence fixes
without knowing which floors are load-bearing.

| Area | State |
|---|---|
| Farmer registration | Real. Persists to `localStorage`, drives everything downstream. |
| Auth (`core/auth`) | **Facade.** `login()` just stores whichever registered farmer was picked — no password, no credential check. `AuthService` and `FarmerRegistrationService` are the closest thing to a session model. |
| Map / field drawing (`map/farm-draw`) | Real. Leaflet-based drawing, saved to `localStorage`, has unit tests. |
| Crop timeline (`features/crop-timeline`) | Real CRUD, but defines **its own** `ActivityEntity` model for sub-activities (irrigation, spraying, harvest, etc. with typed `metadata`). |
| Farm activity (`features/farm-activity`) | Real CRUD, but defines a **second, different** `Activity` + `ActivityExpense` model, built later, that overlaps in purpose with crop-timeline's `ActivityEntity` but has a different status enum, a free-text activity name instead of a typed enum, and its own expense sub-model. `create-activity.component.ts` even reaches into `CropTimelineService.activities()` to populate a "parent activity" dropdown — mixing the two models in one screen. |
| Weather (`features/weather`) | **100% hardcoded.** Signals are seeded with fixed values and fixed May dates. No `HttpClient` call anywhere in the app — there is no live weather integration at all. |
| Profile | Real, edits the registered-farmer record. |
| Persistence | Every feature talks to `localStorage` directly from its own service. No shared repository/storage abstraction, no backend, no sync — data lives in one browser only and is one "clear site data" away from gone. |
| Tests | 21 spec files exist (decent instinct), but no lint config (`eslint`/`prettier` config) is committed, and there's no CI step that runs `ng test` — the deploy workflow only builds. |
| CI/CD | `.github/workflows/deploy.yml` builds and deploys to `gh-pages` on every push to **either** `main` or `master` — no test gate, no PR requirement, so broken code can ship straight to production. |
| Branches | `main` (GitHub's default) was empty; all real work was on `master`, committed directly (no PRs). This session merged `master`'s history into this branch so `main` can become canonical — see §5. |

**The core structural problem**: two competing "activity" models
(`crop-timeline.models.ts#ActivityEntity` vs `farm-activity.models.ts#Activity`)
covering the same real-world concept — something a farmer did on a field —
because each was built without checking what already existed. This is the
concrete symptom of "modules created randomly," and it's the first thing to
fix before adding more features on top of either one.

## 3. Definition of "successful project" here

- One activity model, one source of truth, used everywhere (crop screens,
  activity screens, dashboards, future reports).
- A persistence layer that isn't hand-rolled per feature, so swapping
  `localStorage` for a real backend later is a service-layer change, not a
  rewrite.
- Auth that actually authenticates, even if the backend is minimal at first.
- Weather that reflects the farmer's real location, not fixed May dates.
- CI that blocks a broken build/test from reaching `gh-pages`.
- A single default branch (`main`) that is always deployable, changed only
  through PRs.

## 4. Phased plan

Each phase is scoped to land as one or a handful of focused PRs — small enough
to review, big enough to move the needle.

### Phase 0 — Foundation (repo hygiene)
- [x] Consolidate `master`'s code into `main` so the default branch isn't empty (done this session, see §5).
- [ ] Add `ng lint` (ESLint + Angular ESLint schematics) and a `format:check` script; run both in CI.
- [ ] Extend `.github/workflows/deploy.yml` (or split into a separate `ci.yml`) to run `ng test` and `ng build` on every PR, and gate the `gh-pages` deploy on those passing. Restrict the deploy trigger to `main` only once `master` is retired.
- [ ] Turn on branch protection for `main` requiring the CI check before merge (repo setting, not a code change — flagging so it's not forgotten).

### Phase 1 — Unify the activity model
- [ ] Pick one shape for "a thing that happened on a field/crop" — recommend keeping `farm-activity`'s simpler `Activity` + `ActivityExpense` (expenses are a real, distinct need) but folding in crop-timeline's typed `ActivityType` enum and `metadata` bag instead of free-text `activityId`.
- [ ] Migrate `crop-timeline` sub-activities onto the unified model; delete `ActivityEntity`.
- [ ] Fix `create-activity.component.ts` to depend on one activity service, not two.
- [ ] Add a migration note/script for any `localStorage` data already saved under the old shapes (dev-only concern today, but do it once instead of twice).

### Phase 2 — Persistence abstraction
- [ ] Introduce a small `StorageService`/repository interface each feature service calls instead of touching `localStorage` directly.
- [ ] No behavior change yet — this just isolates the swap point for Phase 5.

### Phase 3 — Real auth
- [ ] Add a password/PIN field at registration and check it at login (still local-only is fine for now — the point is "login" stops being "pick a name from a list").
- [ ] Guard routes consistently (`map`, `weather`, `profile`, `crops`, `activities` already use `authGuard` — keep it that way as new routes are added).

### Phase 4 — Real weather
- [ ] Integrate a live weather API (e.g. OpenWeatherMap/Open-Meteo) keyed by the farmer's village/district or drawn field's coordinates.
- [ ] Replace the hardcoded `WeatherComponent` signals with data from that call; keep the existing UI/layout.

### Phase 5 — Backend & sync
- [ ] Stand up a real backend (Firebase/Supabase or a small Node API) behind the Phase 2 storage interface, so a farmer's data survives a cleared browser and works across devices.
- [ ] Migrate auth to that backend.

### Phase 6 — Feature completion
- [ ] Cross-link crop-timeline and farm-activity dashboards now that they share one model (e.g. a crop's timeline shows its linked activities and their costs).
- [ ] Reporting/export (expense reports, crop history) once data volume justifies it.

## 5. Branch consolidation (this session)

- `main` was GitHub's default branch but contained only `README.md`/`LICENSE`/`.gitignore`.
- `master` held all real development, committed directly without PRs.
- This branch (`claude/hosted-information-v82lag`) merged `origin/master` in cleanly (no conflicts — `master`'s history already descends from `main`'s initial commit), so it now carries the full app.
- Recommendation: once this branch is merged into `main`, treat `master` as legacy — stop pushing to it, and after a grace period delete it so there's one unambiguous source of truth.

## 6. Immediate next actions

1. Merge this branch to `main` (PR), making `main` the real default branch.
2. Land Phase 0 (lint + CI test gate) before anything else — it's what stops the *next* random module from landing unreviewed.
3. Pick the unified activity shape (Phase 1) as the first feature-level PR.
