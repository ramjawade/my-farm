# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MyFarm** is a farm-management web app for Indian smallholder farmers. It enables farmers to:
- Register a farm and create a farmer profile
- Draw and manage field boundaries on a map
- Track crops through their lifecycle
- Log field activities (irrigation, spraying, harvest, etc.) and expenses
- Check live weather and receive weather-based farming advisories

Built with **Angular 20** (standalone components, signals) as an `ng-workspace` with two projects:
- `projects/home/` — the main application
- `projects/shared/` — a shared component library (currently a confirm dialog)

See [ROADMAP.md](./ROADMAP.md) for the full product plan, known gaps, and phased development strategy.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Angular 20 | Framework, standalone components, signals, zoneless change detection |
| **Styling** | Bootstrap 5, Bootstrap Icons | UI components and icons |
| **Charting** | Chart.js | Activity cost trends |
| **Mapping** | Leaflet, D3 | Field drawing and visualization |
| **Networking** | RxJS, HttpClient | API calls (async operations) |
| **Testing** | Jasmine, Karma | Unit tests and coverage |
| **Build** | Angular CLI, ng-packagr | Project bundling and distribution |
| **Linting** | ESLint, Angular ESLint, Prettier | Code quality and formatting |
| **Persistence** | `localStorage` | Local data storage (Phase 5 will add backend sync) |

## Common Development Commands

```bash
# Development
npm run start              # Start dev server at http://localhost:4200
npm run watch             # Build projects in watch mode

# Building
npm run build             # Build both shared and home projects
npm run build:prod        # Optimized production build (for deployment)

# Testing
npm run test              # Run all unit tests (headless Chrome, no watch)

# Linting & Formatting
npm run lint              # Run ESLint on all TypeScript files
npm run format:check      # Check if files are formatted per Prettier rules
npm run format:fix        # Auto-format files

# Quality Gates (all must pass before pushing)
npm run lint && npm run build && npm run test
```

## Codebase Architecture

### Core Services Layer (`projects/home/src/app/core/`)

These are singleton services managing domain state and business logic:

- **`auth/`** — User authentication (currently a facade; Phase 3 will add PIN-based auth)
  - `AuthService` — manages current user session and login state
  - `FarmerRegistrationService` — persists farmer profile data

- **`weather/`** — Weather data fetching and caching
  - `WeatherService` — fetches current weather and 5-day forecast from OpenWeatherMap API
  - `WeatherCacheService` — caches weather data with TTL (30 min) and max age (2 hours)
  - Models: `WeatherLocation`, `WeatherData`, `CurrentWeather`, `FiveDayForecast`

- **`storage/`** — Persistence abstraction (Phase 2)
  - `StorageService` — interface for localStorage operations
  - `LocalStorageService` — implementation using browser `localStorage`

- **`config/`** — App-level configuration (e.g., API keys, base URLs)

### Feature Modules (`projects/home/src/app/features/`)

Feature modules implement domain-specific screens and logic. Each typically has:
- A service (managing state and API calls)
- Components (UI and user interaction)
- Models (TypeScript types for domain entities)

**Key Modules:**

- **`farmer-registration/`** — Initial farmer setup flow
  - Collects farm details, location, crops, irrigation type, farming method
  - Saves to `localStorage` and drives downstream features

- **`weather/`** — Weather dashboard and advisories
  - Real-time weather display with alerts
  - Crop-specific farming advisories based on weather
  - Sub-components: `sun-path`, `history-trend`, `advisory-panel`, `alert-panel`

- **`crop-timeline/`** — Crop lifecycle tracking
  - Add/edit crops for a field
  - Track crop lifecycle stages (planting, growth, harvest, etc.)
  - Sub-activities with typed metadata
  - **Caveat:** Uses its own `ActivityEntity` model; Phase 1 unified this with farm-activity

- **`farm-activity/`** — General activity and expense logging
  - Log field activities (free-text name)
  - Track associated expenses
  - Dashboard with cost trends via Chart.js

- **`profile/`** — Farmer profile management
  - Edit registered farmer details
  - Persist changes to `localStorage`

- **`home/`** — Landing page and navigation hub

- **`auth/`** — Auth UI (login, registration flows)

- **`activity/`** — Generic activity model and utilities

### Map Module (`projects/home/src/app/map/`)

Leaflet-based field drawing and visualization:
- `farm-draw/` — Interactive field boundary drawing
- `component/` — Map display, search, saved farms UI
- `controls/` — Custom map controls
- `models/` — Shape and field data types

### Layout Module (`projects/home/src/app/layout/`)

Shared layout components:
- `app-layout` — Main container
- `sidebar`, `toolbar`, `footer` — Navigation and footer UI
- `main` — Content area router

## Directory Structure

```
projects/home/src/app/
├── core/              # Singleton services (auth, weather, storage, config)
├── features/          # Feature modules (weather, crops, activities, profile, registration)
├── map/               # Leaflet-based field drawing and visualization
├── layout/            # Shared layout components
├── app.routes.ts      # Top-level routing configuration
└── app.component.ts   # Root component
```

## Key Testing Patterns

- **HTTP mocking:** Use `HttpClientTestingModule` and `HttpTestingController` to mock API calls
- **Async/await in tests:** Use `async` / `await` keywords for Promise-based operations; use `setTimeout()` for timing-sensitive setups
- **Signal testing:** Computed signals auto-update; test dependencies carefully to avoid stale values
- **Cache testing:** Directly manipulate cache timestamps rather than using real `setTimeout` waits to avoid slow tests

---

# Claude Code Development Workflow

## Overview
This document outlines the workflow and rules for developing features with Claude Code on this project.

## Plan-Then-Implement Workflow

Every feature follows two distinct stages, each on a different model, in this order:

1. **Plan Stage** — model: `sonnet`, reasoning effort: `medium`
   - Produce a concise implementation plan (scope, files to touch, approach, risks).
   - Present the plan to the user and **wait for explicit approval** before writing any code.
   - Do not start implementation, branch creation, or commits during this stage.
2. **Implementation Stage** — model: `haiku`
   - Only begins after the user approves the plan from Stage 1.
   - Follows the approved plan to create the branch, write code, tests, and open the PR per the Branch Lifecycle below.
   - If the implementation needs to deviate materially from the approved plan, stop and re-confirm with the user rather than improvising.

### Rule
- ❌ Never skip straight to implementation without an approved plan.
- ❌ Never use the implementation model to author the plan, or the planning model to write the final code.
- ✅ Re-plan (Stage 1) whenever requirements change mid-feature, instead of patching the plan silently during implementation.

## Usage Optimization Rules

To keep token/API cost down while developing on this repo:

### ✅ DO
- Keep Plan Stage reasoning effort at `medium` (never `high`/`xhigh`) unless the task is genuinely architectural.
- Prefer `Grep`/`Glob` over shell `find`/`grep`/`cat` — smaller, targeted output beats raw dumps.
- Use the `Explore` subagent for open-ended searches (>3 lookups) instead of manual back-and-forth in the main thread, to keep large search results out of the primary context.
- Batch independent tool calls into a single turn rather than issuing them serially.
- Reuse context already in the conversation — don't re-read a file you already have open or just edited.
- Keep commit messages and PR descriptions concise; skip generated summary docs unless requested.

### ❌ DON'T
- Don't spawn a subagent for a task you can complete in 1-2 direct tool calls.
- Don't re-run the same search/grep query multiple times with minor variations — narrow the pattern first.
- Don't request `high`/`xhigh` reasoning effort by default — reserve it for genuinely hard design/debugging problems.
- Don't duplicate work between the main thread and a delegated subagent (i.e., don't re-verify what an agent already reported unless the change is safety-critical).

## Branch Strategy

### Naming Convention
- Feature branches: `claude/feature-<description>` (e.g., `claude/feature-auth-integration`)
- Bugfix branches: `claude/bugfix-<issue>` (e.g., `claude/bugfix-activity-sync`)
- Phase branches: `claude/phase-<number>-<description>` (e.g., `claude/phase-2-persistence-layer`)

### Branch Lifecycle
0. **Plan**: Create PHASE_N_PLAN.md document, commit & push as first commit
1. **Create**: Branch from latest `main` 
2. **Work**: Complete, testable feature only
3. **Verify**: 
   - ✅ Plan document committed
   - ✅ `npm run build` passes
   - ✅ `npm run lint` passes
   - ✅ Unit tests ready
   - ✅ Feature tested locally
4. **Commit**: Clear, descriptive commit messages
5. **Push**: Push to remote branch
6. **Create PR**: Create pull request for review
7. **Merge**: Merge to main via PR
8. **Delete**: Delete branch (both local and remote) immediately after merge

## Rules & Guidelines

### ✅ DO
- **Commit phase plans** (PHASE_N_PLAN.md) as first commit on feature branch
- Create **focused, testable features** only per branch
- Complete features before merging (no half-finished work)
- Run full test suite before pushing
- Write clear commit messages
- Delete branches after merging
- Use descriptive PR titles and descriptions
- Keep branches short-lived (1-2 days max)

### ❌ DON'T
- Reuse merged branches for new work
- Commit incomplete/untested features
- Leave branches orphaned after merge
- Accumulate multiple features in one branch
- Force push to main/master
- Skip build/lint checks before push
- **Push directly to main without a PR** — all changes must go through PR review, even hotfixes

## CI/CD Gates

Before any PR merge, these must pass:
- ESLint: `npm run lint` ✓
- Build: `npm run build` ✓
- Tests: Unit test suite ready ✓

## Feature Checklist

For each feature branch:

```markdown
- [ ] Feature is complete and testable
- [ ] npm run build passes
- [ ] npm run lint passes  
- [ ] Unit tests added/updated
- [ ] Feature tested in browser
- [ ] Commit messages are clear
- [ ] PR description is complete
- [ ] Ready to merge
- [ ] Merge to main via PR
- [ ] Delete branch after merge
```

## Workflow Example

```bash
# 1. Start new feature
git fetch origin main
git checkout -b claude/feature-activity-export

# 2. Make changes, commit
git add projects/...
git commit -m "Add activity export to CSV functionality"

# 3. Verify
npm run lint  # ✓
npm run build # ✓

# 4. Push and create PR
git push -u origin claude/feature-activity-export

# 5. (After review & merge)
# Delete branch on GitHub

# 6. Clean up locally
git branch -D claude/feature-activity-export
```

## Current Status

- Phase 0: ✅ Complete (ESLint, CI gates)
- Phase 1: ✅ Complete (Unified Activity Model)
- Phase 2: ✅ Complete (Storage abstraction layer)
- Phase 3: ✅ Complete (PIN-based authentication + session expiry)
- Phase 4: 🔄 Next (Real weather API integration) — Plan approved, awaiting implementation

## Next Features

Ready to work on testable features (each starts with an approved plan, per Plan-Then-Implement Workflow above):
- Phase 4: Real weather API integration (OpenWeatherMap integration with caching & advisories)
- Phase 5: Backend sync layer
- Phase 6: Feature completion & polish

---

**Last Updated**: 2026-09-02
**Process**: Plan-Then-Implement (sonnet plan → approval → haiku implementation)
**Recent**: Added comprehensive architecture guide, technology stack, and testing patterns documentation
