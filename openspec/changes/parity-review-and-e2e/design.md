# Design

## Context

- Every roadmap screen was rebuilt in its own change, so each was only compared with the prototype at the time it was built. Nothing has compared the whole app since banners (5.1) and system states (5.2) landed.
- The prototype is `design/prototype/myfarm-prototype.html`; the design system is `design/prototype/myfarm-design-system.html`. Both approved screens and their sub-screens are listed in the prototype's `TITLES` and `PARENT` maps.
- `e2e/golden-path.spec.ts` runs on two Playwright projects (Desktop Chrome and a Pixel 5 phone) against the real backend in the CI `e2e` job. It still expects the address `/map` after sign-in and registration, while the router now has Home at the empty path; whether that is stale or intended is one of the first things to check.
- The backend cannot be run locally here (no reachable Postgres); the dev proxy (`npm start`) points at the deployed API.
- `npm ci` fails on the lock file, so this change adds no dependency.

## Goals / Non-Goals

**Goals:**
- One gap list that says, for every screen, whether the app matches the prototype on desktop and phone, with each difference classified.
- App gaps fixed; the golden path green on both projects; accessibility failures fixed or listed with a reason.

**Non-Goals:** see proposal. In particular no new tooling or screenshot baselines.

## Decisions

**1. Screens reviewed.** The prototype's own screens and sub-screens:

| Group | Screens |
|---|---|
| Sign-in and profile | login, profile |
| Home | home (with banners) |
| Lands | lands, draw and save a land |
| Crops | crops, addcrop, cropdetail |
| Activity | log, addact, addexp, actdetail |
| Reports | reports |
| Prices | prices, pricedetail, apmcs, newwl, addwi |
| Assistant | chat (page and overlay) |
| System | states (404, could not load, loading, offline), banners |
| Known gaps, not reviewed in depth | weather (4.5), alerts and addalert (4.3b) |

**2. How to compare.** For each screen, open the prototype and the app at a desktop width (1280 px) and a phone width (390 px), in the light theme (the default), and note differences in layout, wording, spacing, icons, states (empty, error, loading) and behaviour. Screenshots are taken with headless Playwright into a scratch folder (not committed) so the two can be read side by side. The app runs with `npm start` against the deployed API and a test farmer who has data; the prototype's "Sample farm" and "Empty farm" modes are the reference for both populated and empty states. Dark theme is checked once per screen in the accessibility pass, not in the parity review.

**3. Classifying a difference.** Each gap in the list below gets one of:
- *App gap*: the app is wrong; fixed in this change.
- *Prototype gap*: the prototype is wrong or out of date; not fixed in code, shown to the user, who decides which side changes. A prototype edit follows the normal approval first.
- *Accepted*: a deliberate difference (for example real data instead of sample data, or browser behaviour); the reason is written next to it.
Anything that cannot be decided from the files alone is also shown to the user, never decided silently.

**3a. Checkpoint before fixing.** Fixing starts only after the user has seen the gap list and agreed the classification. Fix tasks are then added to `tasks.md` (one per gap or per screen group) through the update workflow, so the plan stays honest about what will be built.

**4. Golden path.** Keep one end-to-end flow (register, sign in again, draw and save a land, plant a crop, log an activity, add an expense, generate and export a report) and update it to the current routes, labels and screens. It stays on both Playwright projects. The review's findings decide what else it needs; extra assertions only where a step already passes through the screen (for example that a banner is not blocking a control). No new test files unless a flow cannot sit in the golden path.

**5. Accessibility, without a new dependency.** Walk each screen by keyboard (Tab order, visible focus, Enter and Space on every control, no traps, Escape closes dialogs and menus), check that every control and image has a name, headings are in order, error and status messages are announced, colour contrast holds in light and dark, and reduced motion is honoured. Where a check can be automated cheaply inside the existing Playwright run (for example buttons and inputs have accessible names), it goes into the golden path; the rest is recorded in the gap list as passed or fixed.

## Gap list

Filled in during the review. Format: `screen | desktop or phone | what differs | app gap, prototype gap or accepted | status`.

_(empty until the review runs)_

## Risks / Trade-offs

- **Unknown size.** The fix work cannot be sized before the review. The checkpoint (3a) lets the user split it into several changes if the list is long.
- **Test data.** The review needs a farmer with lands, crops, activities, expenses, sales and prices. The user supplies or creates one; nothing is created on the deployed service by this change.
- **Real data vs sample data** will differ everywhere; these are accepted unless the shape (not the values) is wrong.
- **Manual review is by eye.** It will miss pixel-level differences; that is accepted, since a visual regression tool is a non-goal.

## Open questions

- Which farmer account and which API (deployed or a local backend) to use for the review.
- Whether weather and price alerts should be reviewed anyway so their gaps are on record (they are listed as known gaps for now).
