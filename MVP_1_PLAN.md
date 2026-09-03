# MVP 1 — Client-Presentable Working Prototype

**Branch:** `claude/mvp-prototype-plan-7wk14j` (plan only; implementation lands as the PRs in §6)
**Status:** DRAFT — awaiting review/approval
**Supersedes for sequencing:** ROADMAP.md Phase 5 (backend) is deferred to MVP 2; parts of Phase 6 (cross-linking, reports) are pulled forward. ROADMAP.md is updated in PR 0.

---

## 1. Goal

Turn the current feature-by-feature app into **one coherent, demo-able product** that a client can click through end-to-end without hitting a dead end, a fake number, or two screens that disagree about the same data.

MVP 1 is judged by a single scripted demo (§9) that a non-technical person can run on a phone or laptop in under 10 minutes:

> Register → set up farm → draw a land plot → add a crop on that plot → log activities and expenses against the crop → see costs roll up on the crop, land and dashboard → check live weather for the farm → export a season expense report.

Everything in scope either makes that path work, makes it honest, or makes it look finished.

## 2. What exists today (audit findings)

Facts verified in the codebase on 2026-09-03. Each is an ambiguity or gap that the plan resolves.

| # | Finding | Where | Why it matters for a client demo |
|---|---|---|---|
| F1 | **Two activity models still coexist.** ROADMAP says Phase 1 deleted `ActivityEntity`, but `crop-timeline.models.ts` still defines it (with its own `ActivityType` and `ActivityStatus` = `Planned/Scheduled/Completed/Cancelled`). `CropTimelineService` mirrors `ActivityService` events into an `ActivityEntity[]` signal with a lossy status map; `crop-timeline-detail` and `activities-summary` consume the mirror. | `features/crop-timeline/*`, `features/farm-activity/summary/*` | Crop screens and activity screens can disagree on status/cost. Any new feature must pick one of two models. |
| F2 | **Storage abstraction covers only half the data.** `IStorageService` has activities, expenses, weather history. Crops, saved farms (lands), farmer profiles and sessions still call `localStorage` directly from their own services. | `core/storage/storage.interface.ts`, `crop-timeline.service.ts`, `farm-draw.service.ts`, `farmer-registration.service.ts`, `auth.service.ts` | The "swap for a backend later" promise (Phase 2) is only true for activities. Also blocks a clean export/import/reset. |
| F3 | **Weather silently runs on mock data.** `API_CONFIG.openWeatherMap.apiKey = 'demo-key'`; every request fails and the 4-tier fallback serves `getMockWeatherData()`. The UI does not say so. | `core/config/api.config.ts`, `core/weather/weather.service.ts` | Showing a client "live weather" that is hardcoded is a credibility risk. |
| F4 | **Fabricated marketing numbers** on the public landing page ("15,000+ Active Farmers", "50,000+ Hectares Mapped", "98% Retention Rate"). | `features/home/home.component.html` | Must not be shown to a client. |
| F5 | **Three independent seed datasets** that don't tell one story: `seedDefaultFarmer()`, `seedMockData()` (crops + activities), `seedDefaultSavedFarm()`; demo login (`loginAsDemo`) hardcodes a fourth user object inline in `HomeComponent`. No activity/expense seeds go through `ActivityService`. | `farmer-registration.service.ts`, `crop-timeline.service.ts`, `farm-draw.service.ts`, `home.component.ts` | Demo data is the product in a prototype. It needs to be one coherent farm. |
| F6 | **Crop ↔ Land ↔ Activity links are loosely typed.** `CropEntity.fieldId` is a `SavedFarm.id` (auto-selected in add-crop) but the model comment says `"Field A"`. `Activity` has independent optional `cropId` *and* `fieldId`, so an activity can be on a crop that lives on a different field. `season` is a free string. | `crop-timeline.models.ts`, `activity.models.ts` | Roll-ups (cost per land, cost per crop) are ambiguous when links conflict. |
| F7 | **Navigation is not a finished IA.** Sidebar shows "Register Farmer" to logged-in users; no Reports entry; no `**` wildcard route (unknown URL renders blank); GitHub Pages has no SPA fallback so a refresh on `/my-farm/crops` returns GitHub's 404. | `layout/sidebar/sidebar.html`, `app.routes.ts`, `deploy.yml` | Dead ends during a demo. |
| F8 | **No user feedback primitives.** No toast/notification service; deletes in some screens don't use the shared `ConfirmDialog`. | `projects/shared`, feature components | Actions feel unconfirmed; accidental deletes during a demo. |
| F9 | **`preferredLanguage` is collected but nothing is localized.** | registration, profile | Asking for a preference the app ignores looks unfinished. |
| F10 | **Attachments are Base64 images in `localStorage`.** | `activity.models.ts` | 5 MB quota; a few photos will break persistence mid-demo. |
| F11 | **Three area-unit conventions**: farmer `farmAreaUnit`, crop `areaUnit`, `SavedFarm.area` stores all three. Displayed unit varies by screen. | models | Numbers that don't match across screens. |
| F12 | **No e2e/smoke test.** 29 Karma spec files, CI runs lint/format/test/build, but nothing exercises the routed golden path in a browser. | `.github/workflows/deploy.yml` | Regressions in the demo path are only caught by hand. |
| F13 | **Not installable / no offline shell.** Data is already local-only, so a PWA manifest + service worker is cheap and matches the rural-connectivity story. | `angular.json`, `index.html` | Client perception; farmers-on-phones narrative. |

## 3. Decisions to lock (please confirm or override)

Each one removes an ambiguity that would otherwise be re-decided by whoever implements the next PR. Recommended option is listed first.

| ID | Decision | Recommendation | Alternative |
|---|---|---|---|
| D1 | Backend in MVP 1? | **No.** Stay on `localStorage` behind a *complete* `IStorageService` (F2), add JSON backup/restore + demo reset. Backend is MVP 2. | Firebase/Supabase now (adds 1–2 weeks, auth rewrite, and secrets management before anything is demo-able). |
| D2 | Weather: live or honest mock? | **Live, with a restricted client-side key** injected at CI build time from a GitHub secret; UI shows a "Live" / "Demo data" badge depending on which tier served the data. | Keep mock, label it "Demo data" everywhere. |
| D3 | Localization | **Defer.** Keep `preferredLanguage` in the profile, remove it from the registration form, no i18n in MVP 1. | Ship English + Hindi with Angular i18n (≈1 week, doubles QA). |
| D4 | Activity attachments | **Disable in MVP 1** (hide the upload control, keep the field in the model). | Cap at 2 images ≤200 KB each with client-side resize. |
| D5 | Demo login | **Keep "Explore Guest Demo"** (no PIN) but make it the *only* thing that seeds data, via one `DemoDataService`. Registered users start empty with an onboarding checklist. | Remove guest demo; presenter registers live each time. |
| D6 | Canonical activity model | **`features/activity` `Activity` + `ActivityExpense` only.** Delete `ActivityEntity`; crop screens read `ActivityService` directly. Canonical statuses: `Draft, Scheduled, In Progress, Completed, Cancelled`. | Keep the mirror (status quo). |
| D7 | Link rule for Crop / Land / Activity | **Activity → Crop is primary; `fieldId` is derived from the crop when a crop is chosen** and only user-editable when no crop is linked (land-level work such as bore installation). `Season` becomes a typed union `'Kharif' \| 'Rabi' \| 'Zaid'`. | Keep both free. |
| D8 | Area unit | **Store canonical square metres / hectares; display in the farmer's `farmAreaUnit` everywhere** via one `AreaPipe`. | Per-entity units (status quo). |
| D9 | Reports scope | **One Reports page**: expenses by crop, by category, by month for a selected season; CSV export. | Full Phase 6 reporting (defer). |
| D10 | Target devices | **Mobile-first (360 px) and desktop**, tested on both in the smoke test. | Desktop only. |

## 4. Scope — features and how they link

```
Register/Login ──► Onboarding checklist (Dashboard)
                        │ 1. Farm profile   ──► Profile
                        │ 2. Draw a land    ──► Lands (map)      ─┐
                        │ 3. Add a crop     ──► Crops ◄── on land ─┘
                        │ 4. Log activity   ──► Activities ◄── for crop (field derived)
                        │                          └── Expenses
                        ▼
                  Dashboard KPIs ◄── roll-ups from Activities/Expenses
                  Crop detail   ◄── linked activities + cost
                  Land detail   ◄── crops on this land + cost
                  Reports       ◄── expenses by crop/category/month, CSV
                  Weather       ◄── farm location (centroid of first land, else profile location)
```

### In scope

1. **Auth & onboarding** — existing phone+PIN login; registration trimmed to identity + PIN; dashboard onboarding checklist (profile → land → crop → activity) that disappears when complete; empty states on every list.
2. **Lands** — existing Leaflet drawing; land detail panel lists crops on that land and total cost; delete uses `ConfirmDialog` and is blocked if crops reference it.
3. **Crops** — existing CRUD; `fieldId` strictly a `SavedFarm.id` with land name shown; detail shows linked activities from `ActivityService` and cost roll-up; "Add activity" pre-fills crop + field.
4. **Activities & expenses** — existing CRUD on the unified model; season typed; field derived from crop (D7); attachments hidden (D4); status set per D6.
5. **Dashboard** — real KPIs (active crops, activities this week, spend this season, next scheduled activity), weather card, onboarding checklist; fake marketing stats removed.
6. **Reports** — new page per D9, plus JSON backup/restore and "Reset demo data" (settings section in Profile).
7. **Weather** — live per D2, location from farm centroid, "Live/Demo/Cached" badge.
8. **Presentability** — toast service, wildcard route + SPA fallback, sidebar IA (`Home · Lands · Crops · Activities · Weather · Reports · Profile`), version/build stamp in footer, PWA manifest + icons + service worker.
9. **Quality** — unit tests for every new service/pipe; Playwright smoke test of the golden path on mobile + desktop viewports, run in CI on PRs.

### Out of scope (MVP 2+)

Backend/sync, multi-device, i18n, attachments, push notifications, market prices, soil sensors, multi-user roles, offline conflict resolution.

## 5. Technical design

### 5.1 Data model (after PR 1)

```ts
// core/models/season.ts
export type Season = 'Kharif' | 'Rabi' | 'Zaid';

// crop-timeline.models.ts — ActivityEntity, ActivityType, ActivityStatus REMOVED
export interface CropEntity {
  id: string; userId: string; fieldId: string /* SavedFarm.id */; name: string; cropType: string;
  areaSqm: number; sowingDate?: number; currentStage: CropStage; status: CropStatus;
  expectedHarvestDate?: number; season: Season; createdAt: number; updatedAt: number;
}

// activity.models.ts — unchanged shape, tightened types
season?: Season;        // was string
fieldId?: string;       // derived from crop when cropId set (enforced in ActivityService.add/update)

// map.models.ts
export interface SavedFarm { ...; userId: string; areaSqm: number; /* FarmAreaResult kept for compatibility */ }
```

Migration: `features/activity/migration.ts` gains a `v2` step (crop `area`+`areaUnit` → `areaSqm`, `season` normalization, `userId` backfill from the active session). Runs once on load, idempotent, versioned by a `my_farm_schema_version` key.

### 5.2 Storage (PR 2)

`IStorageService` extended with `getCrops/saveCrop/updateCrop/deleteCrop`, `getFarms/saveFarm/deleteFarm`, `getFarmer/saveFarmer/listFarmers`, `exportAll(userId): Promise<BackupFile>`, `importAll(userId, BackupFile)`, `clearUser(userId)`. `LocalStorageService` implements them with the existing key scheme (`my_farm_<userId>_<entity>`). `CropTimelineService`, `FarmDrawService`, `FarmerRegistrationService` are refactored to call the interface; `AuthService` keeps session keys in `localStorage` (session ≠ data). No behaviour change; existing specs must stay green.

### 5.3 Cross-feature reads without circular DI

`CropTimelineService` and `FarmDrawService` expose `computed()` selectors (`cropsForField(fieldId)`, `costForCrop(cropId)`) built on top of `ActivityService.activities()/expenses()`. Dependency direction is one-way: `farm-draw ← crop-timeline ← activity`. The `changes$` Subject mirror is deleted.

### 5.4 Demo data (PR 3)

`core/demo/demo-data.service.ts` owns one dataset: farmer "Ram Jawade" (Pune), two lands with real polygons near 18.52 N 73.85 E, crops Soybean (Kharif, land 1) and Wheat (Rabi, land 2), ~14 activities spanning sowing → harvest with expenses totalling a believable season cost, 7 days of weather history. `seedIfEmpty(userId)` is called only by "Explore Guest Demo"; `reset()` is exposed in Profile → Settings. Existing per-service seeds are deleted.

### 5.5 Weather key (PR 6)

`projects/home/src/environments/environment.ts` (`openWeatherApiKey: ''`) and `environment.prod.ts` populated at CI time from `secrets.OPENWEATHER_API_KEY` via a `sed`/`envsubst` step before `build:prod`. Key restricted in OpenWeatherMap to the GitHub Pages origin. `WeatherService.source` signal (`'live' | 'cache' | 'demo'`) drives the badge. Location resolution order: centroid of the first saved land → profile `location` → district geocode → error state.

### 5.6 Presentability primitives (PR 4)

- `shared/lib/toast`: `ToastService.show(message, kind)` + `<lib-toast-outlet>` in `app-layout`.
- `app.routes.ts`: `{ path: '**', component: NotFoundComponent }`.
- `deploy.yml`: copy `index.html` → `404.html` in `dist/home/browser` before publish (GitHub Pages SPA fallback).
- `AreaPipe` (`{{ areaSqm | area:unit }}`) and `InrPipe` for consistent numbers.
- Footer: `v{package.version} · build {short sha}` injected at build.

### 5.7 PWA + smoke test (PR 7)

`@angular/pwa` schematic (manifest, icons, `ngsw-config.json` caching app shell + Leaflet assets; OpenWeatherMap excluded). Playwright (`@playwright/test`, Chromium already on CI runners) with one spec `e2e/golden-path.spec.ts` parameterised over `{ mobile: 360x780, desktop: 1366x800 }`; new CI job `e2e` on pull requests only.

## 6. Work breakdown — one PR per row, each independently mergeable

Ordered so every PR leaves `main` demo-able. Sizes assume the implementation model follows the file list literally.

| PR | Branch | Deliverable | Files (create / modify) | Tests | Size |
|---|---|---|---|---|---|
| 0 | `claude/mvp-prototype-plan-7wk14j` | This plan + ROADMAP.md re-sequenced | `MVP_1_PLAN.md`, `ROADMAP.md` | — | XS |
| 1 | `claude/mvp1-unify-activity-model` | Delete `ActivityEntity`; crop detail + summary read `ActivityService`; typed `Season`; field derived from crop; `areaSqm` + `AreaPipe`; schema v2 migration | mod: `crop-timeline.models.ts`, `crop-timeline.service.ts`, `crop-timeline-detail.component.*`, `activities-summary.component.*`, `activity.models.ts`, `activity.service.ts`, `create-activity.component.*`, `add-crop.component.*`, `map.models.ts`; new: `core/models/season.ts`, `core/pipes/area.pipe.ts`, `core/pipes/inr.pipe.ts`; mod: `features/activity/migration.ts` | update crop-timeline + summary specs; new pipe + migration specs | M |
| 2 | `claude/mvp1-storage-complete` | `IStorageService` covers crops/farms/farmers + export/import/clear; services stop touching `localStorage` | mod: `storage.interface.ts`, `local-storage.service.ts`, `crop-timeline.service.ts`, `farm-draw.service.ts`, `farmer-registration.service.ts` | extend `local-storage.service.spec.ts`; existing service specs green | M |
| 3 | `claude/mvp1-demo-data-onboarding` | `DemoDataService`; per-service seeds removed; onboarding checklist + empty states; registration trimmed (D3); Profile → Settings with Reset demo / Backup / Restore | new: `core/demo/demo-data.service.ts`, `core/demo/demo-dataset.ts`, `features/home/onboarding-checklist.component.*`, `shared/lib/empty-state.component.*`; mod: `home.component.*`, `farmer-registration.*`, `profile.component.*`, list components | demo service spec (idempotent seed, reset clears only demo user); checklist spec | M |
| 4 | `claude/mvp1-presentability` | Toast service; `ConfirmDialog` on every delete; wildcard route + `NotFoundComponent`; SPA 404 fallback; sidebar IA; fake stats removed; footer build stamp | new: `shared/lib/toast/*`, `features/not-found/*`; mod: `app.routes.ts`, `sidebar.html`, `home.component.html`, `footer.*`, `deploy.yml`, delete handlers in crops/activities/lands | toast spec; route spec for `**` | S |
| 5 | `claude/mvp1-crosslink-reports` | Crop detail cost roll-up + "Add activity" prefill; land detail with crops + cost; dashboard real KPIs; Reports page with CSV export | new: `features/reports/*` (component, `report.service.ts`, `csv.util.ts`); mod: `crop-timeline-detail.*`, `saved-farms.component.*`, `home.component.*`, `app.routes.ts`, `sidebar.html` | report service spec (aggregations, CSV escaping); KPI computed specs | M |
| 6 | `claude/mvp1-live-weather` | Env-based API key via CI secret; source badge; location from land centroid | new: `environments/environment*.ts`; mod: `api.config.ts`, `weather.service.ts`, `weather.component.*`, `angular.json` (fileReplacements), `deploy.yml`, `WEATHER_API_SETUP.md` | weather service spec: source signal per tier, location resolution order | S |
| 7 | `claude/mvp1-pwa-e2e` | PWA manifest/icons/service worker; Playwright golden-path smoke on mobile + desktop in CI; `DEMO_SCRIPT.md` | new: `ngsw-config.json`, `public/manifest.webmanifest`, icons, `e2e/golden-path.spec.ts`, `playwright.config.ts`, `DEMO_SCRIPT.md`; mod: `angular.json`, `package.json`, `deploy.yml` (`e2e` job on PR) | the e2e spec itself | S–M |

Estimated total: **8–10 working days** of implementation at one PR per day, review included. PRs 1→2→3 are sequential (each depends on the previous model/storage shape). PRs 4, 6 can run in parallel with 2–3. PR 5 needs 1–3. PR 7 is last.

Each PR follows CLAUDE.md gates: `npm run lint`, `npm run format:check`, `npm run test`, `npm run build` green before push.

## 7. Suggested additions you did not ask for, but MVP 1 needs

Items I consider **important** are already folded into §6; listed here so the reasoning is visible.

| Item | Why | Where in plan |
|---|---|---|
| One coherent demo dataset + reset button | A prototype *is* its demo data; presenters need to restore state between clients. | PR 3 |
| Onboarding checklist for new registrations | Without it a fresh account is four empty screens with no hint of order. | PR 3 |
| JSON backup / restore | Honest mitigation for "data lives in one browser" until MVP 2 backend; also lets you move a curated demo between devices. | PR 3 |
| Confirm on delete + toasts | Cheapest fix for "did that work?" and accidental deletes during a live demo. | PR 4 |
| Wildcard route + GitHub Pages 404 fallback | Refreshing any deep link currently 404s on the hosted build. | PR 4 |
| Remove fabricated metrics | Compliance/credibility; non-negotiable before a client sees it. | PR 4 |
| Reports + CSV export | The first thing a farm owner asks: "what did this crop cost me?" | PR 5 |
| Live weather with visible data source | Turns the weakest screen into a strength; the badge keeps it honest when the key is absent. | PR 6 |
| PWA installability | "Add to home screen" on a phone is the most convincing 10 seconds of a farmer-app demo. | PR 7 |
| Browser smoke test in CI | Protects the exact path you will demo. | PR 7 |
| Written demo script | Anyone on the team can present the same way. | PR 7 |

**Considered and deliberately deferred**: i18n (D3), photo attachments (D4), backend/auth server (D1), market prices, WhatsApp/SMS reminders, multi-farm per user, role-based access.

## 8. Risks

| Risk | Mitigation |
|---|---|
| PR 1 touches the most-tested code (crop timeline); specs may need heavy rewrites | Keep public signal names (`crops`, `activities`) stable; only the element type changes. |
| Client-side OpenWeatherMap key exposure (D2) | Free-tier key, origin-restricted, rotated after demos; backend proxy in MVP 2. Documented in `WEATHER_API_SETUP.md`. |
| `localStorage` quota with demo data + weather history | Attachments disabled; weather history capped at 30 entries; backup file is the escape hatch. |
| Implementation model deviates from file lists | Plan lists exact files; any deviation triggers a re-plan per CLAUDE.md. |
| Playwright flakiness on Leaflet drawing | Golden path draws with deterministic clicks on a fixed viewport; retries=1 in CI. |

## 9. Definition of done — the demo script (summary; full version lands as `DEMO_SCRIPT.md` in PR 7)

1. Open hosted URL on a phone; "Add to Home Screen" prompt available.
2. Tap **Explore Guest Demo** → dashboard shows Ram's farm with real KPIs and live weather (badge "Live").
3. **Lands** → two plots on the map; open one → its crops and season cost.
4. **Crops** → Soybean detail → timeline of linked activities with per-activity cost, total at top.
5. **Activities** → add "Spray Application" for Soybean (field auto-filled) with an expense → toast → crop total and dashboard KPI update.
6. **Reports** → Kharif 2026 expenses by crop/category/month → Export CSV.
7. **Profile → Settings** → Reset demo data → dashboard returns to seeded state.
8. Log out → **Register** a new farmer with PIN → onboarding checklist guides profile → land → crop → activity; empty states everywhere before that.
9. Refresh on any deep link → page loads (no GitHub 404). Unknown URL → friendly Not Found.

All nine steps pass on mobile (360 px) and desktop; CI green (lint, format, unit, e2e, build).
