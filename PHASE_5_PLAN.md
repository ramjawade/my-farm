# Phase 5 Plan: Firebase Backend & Sync

## Context

ROADMAP.md is explicit about what "production-ready, usable app" actually
requires here: everything today — farmer profiles, auth, activities/expenses,
weather cache — lives in `localStorage` in one browser. There is no backend,
no cross-device access, and a "clear site data" click destroys a farmer's
entire history. Auth is a facade (unsalted client-side SHA-256 PIN check, no
server verification). The weather integration ships its API key straight to
the browser as a query param. Phases 0–4 are done and explicitly gated Phase 5
as "NEXT... Plan to be created and approved before implementation" — this is
that plan. MVP1 scope is **Phase 5 only** (backend + sync); Phase 6 (dashboard
cross-linking, reporting) stays out of this MVP.

**Firebase** (Auth + Firestore) is the chosen backend: it fits the current
GitHub Pages static-hosting deploy with no separate server to run, Firestore's
built-in offline persistence is a real asset for rural connectivity, and
Firebase Auth replaces the hand-rolled PIN-hash session model with actual
server-verified credentials.

## Survey findings grounding this plan

- `IStorageService` (`projects/home/src/app/core/storage/storage.interface.ts`)
  is the intended swap point, but today only `features/activity/activity.service.ts`
  actually uses it. `farmer-registration.service.ts`, `crop-timeline.service.ts`,
  `auth.service.ts`, and `farm-draw.service.ts` all bypass it and hit
  `localStorage` directly with their own keys. This plan widens the interface
  (or adds sibling interfaces) to cover farmer profiles, crop timeline data,
  and drawn fields — not just activities/expenses — otherwise "backend & sync"
  is only true for one feature.
- Auth (`core/auth/auth.service.ts`, `pin-hash.util.ts`,
  `features/farmer-registration/farmer-registration.service.ts`) is a
  session-in-localStorage + unsalted-hash model with a hardcoded seed farmer.
  This becomes Firebase Auth (phone OTP), with `authGuard` continuing to gate
  routes the same way it does today.
- Weather (`core/config/api.config.ts`) hardcodes `apiKey: 'demo-key'`
  directly in committed source with a comment already saying "Phase 5: Move
  to backend proxy." No `src/environments/` exists at all in either project.
  `weather.service.ts` calls OpenWeatherMap directly from the browser.
- No CI secret injection exists today (`.github/workflows/deploy.yml` has no
  env/secrets step) and there are no environment files to hold per-env config
  — both need to be introduced from scratch, not just edited.
- Crop-timeline (`crop-timeline.service.ts`) keeps its own parallel
  localStorage store synced to `ActivityService` via a `changes$` event
  subject to dodge circular DI — this sync mechanism has to survive the
  backend swap (it becomes cross-store consistency at the Firestore layer,
  not just in-memory).

## Decisions

- **Backend**: Firebase (Auth + Firestore), not Supabase or a custom Node API
  — no separate server to host, fits static GitHub Pages hosting.
- **Auth method**: phone number OTP (`signInWithPhoneNumber`), not
  email/password — phone numbers are the reliable identifier for this
  audience.
- **PIN**: kept, but repurposed as a local device re-lock on top of Firebase
  Auth (not the authentication mechanism itself) — useful for shared/family
  devices.
- **MVP1 scope**: Phase 5 only. Phase 6 (cross-linked dashboards, reporting)
  is deferred to a later phase.

## Approach

### Target architecture

```
  Angular app (GitHub Pages, static hosting)
  +----------------------------------------------------+
  |  Components                                         |
  |     |            |                |                 |
  |  AuthService  IStorageService  WeatherService        |
  |  (phone OTP)  (widened iface)  (cache: fresh->       |
  |     |            |             stale->mock)          |
  +-----|------------|----------------|------------------+
        |            |                |
        v            v                v
  +-----------+  +-----------+  +----------------------+
  | Firebase  |  | Firestore |  | Firebase Cloud        |
  | Auth      |  | (profile, |  | Function (weather     |
  | (SMS OTP) |  | activities|  | proxy - holds the     |
  |           |  | expenses, |  | OpenWeatherMap key)   |
  |           |  | crops,    |  |          |             |
  |           |  | fields;   |  |          v             |
  |           |  | offline   |  |   OpenWeatherMap API   |
  |           |  | persist)  |  |                        |
  +-----------+  +-----------+  +----------------------+
```

Everything the browser talks to directly (Firestore client SDK, Firebase
Auth) is safe to expose client-side because access is enforced by Firestore
security rules and Auth tokens — not by secrecy. The one secret that must
never reach the browser is the OpenWeatherMap key, so it moves behind the
one piece of this plan that isn't purely client + BaaS: a Cloud Function.

### 1. Firebase project setup
- New Firebase project (Auth + Firestore in production mode, security rules
  scoped per-farmer via `request.auth.uid`).
- Add `@angular/fire` (or the modular `firebase` JS SDK directly — prefer
  plain `firebase` SDK for smaller bundle/more control, matching the
  project's existing lean-dependency style) to `package.json`.
- Introduce `src/environments/environment.ts` /
  `environment.prod.ts` (new — none exist today) holding Firebase client
  config (`apiKey`, `authDomain`, `projectId`, etc. — these are safe to ship
  client-side by design; security is enforced by Firestore rules, not by
  hiding this config).
- Wire environment file swapping into `angular.json` `fileReplacements` for
  the `production` configuration.

### 2. Auth migration
- Replace `core/auth/auth.service.ts` internals with Firebase Auth **phone
  number OTP** (`signInWithPhoneNumber` + reCAPTCHA verifier, per Firebase
  Auth's web SMS flow). Registration/login screens change to a
  phone-number-entry + OTP-code-entry flow. Keep the existing public surface
  (`isSessionValid()`, `authGuard` contract) stable so route guards and
  components don't change.
- `pin-hash.util.ts`'s hash stops being the *authentication* mechanism (that
  job moves to Firebase's OTP verification) but the PIN itself is kept as a
  **local device re-lock**: after the initial OTP login, the existing
  SHA-256 PIN check gates quick re-entry into the app on that device
  (session still backed by Firebase Auth's token underneath). This keeps
  `pin-hash.util.ts` and the PIN field on the registration form, just
  changes what unlocking the PIN actually does.
- `farmer-registration.service.ts`'s `FarmerRegistrationData` becomes a
  Firestore document keyed by the Firebase Auth `uid`, phone number sourced
  from the verified Firebase Auth credential rather than free-text input,
  `pinHash` retained for the local-relock purpose above. Drop the hardcoded
  seed farmer default.
- Session expiry: Firebase Auth session persistence replaces the manual
  `SESSION_DURATION_MS` timer for the underlying auth session; the app-level
  PIN re-lock becomes the shorter-interval UX gate (e.g. re-prompt PIN after
  some idle period), replacing the old 24h-logout behavior with something
  finer-grained and better suited to a shared-device farm context.

```
  First login on a device:
    Farmer -> App: enter phone number
    App -> Firebase Auth: signInWithPhoneNumber()
    Firebase Auth -> Farmer: SMS OTP
    Farmer -> App: enter OTP + set PIN
    App -> Firebase Auth: confirm OTP  =>  ID token (uid)
    App -> Firestore: create/read farmer profile doc (uid)
    App: store PIN hash locally

  Later re-open on same device:
    Farmer -> App: enter PIN
    App: check PIN hash locally (no network needed)
    App -> Firestore: resume session (Firebase token still valid)
```

### 3. Persistence: widen the storage abstraction and implement Firestore
- Extend `IStorageService` (or add parallel interfaces following the same
  pattern) to cover farmer profile, crop-timeline, and farm-draw data, not
  just activities/expenses — this is required for "backend & sync" to
  actually be true app-wide, not just for one feature.
- New `FirestoreStorageService` implementing the (widened) interface(s),
  swapped in via the existing DI binding point in `app.config.ts`
  (`{ provide: IStorageService, useClass: FirestoreStorageService }`) —
  components should need zero changes, per the interface's original design
  intent.
- Migrate `crop-timeline.service.ts` and `farm-draw.service.ts` off direct
  `localStorage` calls onto the storage interface; keep the existing
  `changes$` sync subject between crop-timeline and activity data, now
  backed by Firestore writes instead of localStorage writes.
- Firestore's offline persistence (`enableIndexedDbPersistence` or the
  modular equivalent) covers the "works with patchy rural connectivity"
  requirement called out in ROADMAP's product framing — enable it as part
  of this phase rather than deferring.

### 4. One-time local→cloud data migration
- On first login post-deploy, detect existing localStorage data
  (`my_farm_registered_farmers`, `my_farm_crops`, activity/expense keys,
  drawn fields) for the signed-in farmer and upload it to Firestore once,
  gated by a completion flag — same pattern already used for the
  crop-timeline→activity migration (`features/activity/migration.ts`), reuse
  that pattern rather than inventing a new one.

### 5. Weather: server-side key + proxy
- Move the OpenWeatherMap API key out of committed source
  (`core/config/api.config.ts`) into a Firebase Cloud Function (natural
  choice since Firebase is now the backend) that proxies weather requests,
  keyed by farmer location, with the key held as a Cloud Functions secret —
  never shipped to the client.
- `weather.service.ts` calls the Cloud Function endpoint instead of
  OpenWeatherMap directly; keep the existing 3-tier cache/fallback strategy
  (fresh cache → stale cache → mock) unchanged, just swap the network call.

### 6. CI/CD updates
- Add Firebase config injection to `.github/workflows/deploy.yml` (GitHub
  Actions secrets → environment file generation step before `npm run
  build:prod`), since no secret-injection step exists today.
- Add a Cloud Functions deploy step (Firebase CLI) for the weather proxy,
  alongside the existing GitHub Pages deploy for the Angular app — the two
  deploy targets (static hosting + Firebase Functions) run independently.
- Keep the existing lint/test/build gate ahead of both deploy steps.

## Verification

- `ng lint`, `ng test` (existing 29 specs must keep passing; add specs for
  `FirestoreStorageService` and the updated `AuthService`), `ng build:prod`.
- Manual end-to-end pass: register a farmer, log in from a second browser
  profile, confirm activities/expenses/crops/fields all appear (proves
  cross-device sync), then go offline and confirm cached data still loads
  and queued writes sync back once online (proves Firestore offline
  persistence is actually wired up).
- Confirm the weather API key no longer appears anywhere in client bundle
  output (`dist/home/browser`) via a grep of the built output.
- Confirm CI pipeline deploys both the Angular app (gh-pages) and the Cloud
  Function (weather proxy) successfully from a test push.
