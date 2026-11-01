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

Reviewed on 2026-11-01 against the deployed API, light theme, English, one farmer (4 lands, 6 crops, 11 activities); the phone buttons were added after a second look at 390 px. Classification is a proposal until the user agrees it (checkpoint 3.1).

| # | Screen | Size | What differs | Proposed class |
|---|---|---|---|---|
| G1 | Activity (nav) | both | The sidebar and the tab bar open `/activities`, the old "Farm Activities" dashboard (stat cards, "Upcoming Activity", a "Chart coming soon (#170)" card). The prototype's Activity is the "All activities" list, which the app has at `/activities/list` and which matches the prototype | App gap (high): point Activity at the list, decide what happens to the old dashboard |
| G2 | Home | both | The weather card has its own amber "Sample data" box inside the card; the prototype card has none (5.1 moved only the Weather page's notice to a banner) | App gap or accepted: ask |
| G3 | Home | both | A "Getting Started: Step 6 of 6, 83%" strip sits above the title; it is not in the prototype | Prototype gap (the onboarding feature is real): ask whether to add it to the prototype or remove it |
| G4 | All | both | The brand reads "My Farm" in plain text with a small leaf; the prototype shows the "MyFarm" wordmark logo | App gap, if the brand-identity spec says wordmark: to check |
| G5 | Home, Lands, Crops | both | Units are long and follow the farmer's profile ("12.52 Acres", "0.7 hec", "152 Days"); the prototype shows "10.50 ac" and "112 days" | Accepted if the unit comes from the profile; ask whether to shorten |
| G6 | Sidebar user card | desktop | Shows "Makhani · 0.86 hectares" (farm area from sign-up) while the lands total 12.52 acres; the prototype shows the lands total | App gap: use the lands total |
| G7 | Lands | desktop | The list has no colour dot per land and no "Fallow" badge for a land without a crop; the header has no pan and zoom hint | App gap (minor) |
| G8 | Lands | desktop | The map has a Street and Satellite switch and a "Street, city, postcode, place…" search; the prototype has a layers button and "Search village or survey no." | Accepted (real map): ask |
| G9 | Lands | desktop | The land card has a "Water source" stat and a "Notes" section; the prototype has four stats and no notes | Prototype gap (features exist): ask |
| G10 | Crops | both | A "Search crops or fields…" box and a card menu are in the app, not in the prototype | Prototype gap (minor): ask |
| G11 | Page not found | desktop | The card sits at the bottom of the content area with empty space above it; the prototype card sits at the top of the page | App gap (minor) |
| G12 | Phone, Lands, Crops, All activities, Reports (and the other pages that carry it) | phone | A round "Back to Home" arrow button floats bottom-right on each page. The mobile header already has a back arrow on sub-pages, and the prototype has no such button. On Lands it sits under the map zoom controls | App gap: remove the back FAB where the header covers it |
| G13 | All screens | phone | The assistant button is a separate round button bottom-left, over the content, on every screen. The prototype has one speed-dial button bottom-right whose menu holds the screen's actions (Log activity, Add expense, Add crop, Draw land, Record sale) and "Ask assistant", hidden on the Assistant page, on sub-screens and while drawing. Home and Prices in the app have no quick actions at all | App gap, large: build the speed dial (needs its own change) or accept the separate button: ask |

Matched at a glance, no differences worth listing: Home layout (KPIs, farm, weather, needs attention, today) on desktop and phone; All activities on desktop and phone; Prices on desktop and phone; Crops cards; Assistant page structure; Reports structure; Profile list.

Not yet reviewed (need real data or clicking through flows): sign-in, add crop, crop detail, add activity, add expense, activity detail, price detail, My APMCs, watchlists, Lands draw and save, Assistant overlay, Reports with data, empty states, dark theme, Hindi and Marathi, banners and offline in the live app, phone width for Lands, Reports, Assistant, Profile and System states. Weather and price alerts are skipped by decision.

## Risks / Trade-offs

- **Unknown size.** The fix work cannot be sized before the review. The checkpoint (3a) lets the user split it into several changes if the list is long.
- **Test data.** The review needs a farmer with lands, crops, activities, expenses, sales and prices. The user supplies or creates one; nothing is created on the deployed service by this change.
- **Real data vs sample data** will differ everywhere; these are accepted unless the shape (not the values) is wrong.
- **Manual review is by eye.** It will miss pixel-level differences; that is accepted, since a visual regression tool is a non-goal.

## Open questions

- Which farmer account to use: the user signs in to the review app themselves (PIN), so the account and its data are theirs; none is created by this change.

Decided with the user (2026-11-01): the review uses the deployed API (`https://myfarm-api.onrender.com`, through the dev proxy, app on its own port because 4200 is taken by another session), and weather is skipped (it stays a known gap; price alerts too).
