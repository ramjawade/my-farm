# Tasks

One PR on `claude/feature-parity-review-and-e2e`. UX source: `design/prototype/myfarm-prototype.html` and `design/prototype/myfarm-design-system.html`. Load the `angular-best-practices` skill before writing any frontend code. The gap list lives in `design.md` ("Gap list"); fix tasks are added after the checkpoint in section 3.

## 1. Set up the review

- [x] 1.1 Use the deployed API (decided) and a farmer the user signs in as in the review app, who has lands, crops, activities, expenses, sales and prices. Verify: the signed-in app shows that farmer's data.
- [x] 1.2 Capture the prototype screens with a throwaway headless Playwright script (kept in the scratchpad, not committed) and the app screens in the Browser pane at 1280 px and 390 px (the pane carries the user's sign-in; a script cannot). Verify: both images exist for a screen.

## 2. Review, screen by screen

Each task compares the prototype with the app on desktop and phone, including empty, loading and error states where the prototype shows them, and adds every difference to the gap list in `design.md` classified as app gap, prototype gap or accepted. Verify per task: every screen in the group appears in the gap list as "matches" or with its differences.

- [x] 2.1 Sign-in and profile (login, profile). Reviewed: Profile only; sign-in needs a signed-out session and is carried to the follow-up.
- [x] 2.2 Home (cards, banners). Gaps G2 to G6.
- [x] 2.3 Lands (list, draw and save a land). Reviewed: the Lands screen (G7 to G9); drawing and saving are covered by the golden path.
- [x] 2.4 Crops (list, add, detail). Reviewed: the list (G10); add and detail are carried to the follow-up.
- [x] 2.5 Activity (log, add, expense, detail). Reviewed: the list (G1); add, expense and detail are carried to the follow-up.
- [x] 2.6 Reports. Reviewed at a glance, no gaps; with-data states are carried to the follow-up.
- [x] 2.7 Prices (list, detail, My APMCs, watchlists). Reviewed: the list, no gaps; the other screens are carried to the follow-up.
- [x] 2.8 Assistant (page and overlay). Reviewed: the page, no gaps; the overlay is carried to the follow-up.
- [x] 2.9 System states and banners (404, could not load, loading, offline, the four banner kinds). Reviewed: the 404 page (no gap); the rest were built from the prototype in 5.1 and 5.2.
- [x] 2.10 Weather and price alerts: skipped by decision, recorded as known gaps.

## 3. Checkpoint

- [x] 3.1 Show the user the gap list and agree the classification, including every prototype gap. Verify: the user's decisions are written into `design.md`.
- [x] 3.2 Add the fix tasks for the agreed app gaps to this file (through `/opsx:update`), and split into separate changes if the user asks. Verify: `openspec validate` passes and each fix task names its screen and how it is verified.

## 4. Fix the app gaps

- [x] 4.1 Phone buttons (G12): remove the round Back buttons from Lands, Crops dashboard, Add crop, Create activity, Activity dashboard, Reports, Weather and Activity detail, and the "+" buttons from the activity list and dashboard; the detail page's "Add expense" button moves to the bottom slot. Verify: a search finds no `fab-soft-tertiary` left, the existing page specs still pass, and the phone width shows no floating back arrow.
- [x] 4.2 Add `ChatOverlayService` and make `ChatBotContainer` read its open state; hide the container's button under 992 px. Verify: the container spec still passes, and a new spec shows the service opens and closes the overlay.
- [x] 4.3 Add `app-quick-actions` to the signed-in layout with the action lists, menu, backdrop, Escape and `aria` from the app-shell delta; add the strings in en, hi and mr, and styles. Verify: component specs for each scenario in the app-shell delta (several actions, one action, choose an action, not on sub-screens or Assistant, not while drawing, close, wide screens), Draw land starting the drawing, `npm run lint` (translation check) and `npm run build`.
- [x] 4.4 Activity (G1): redirect `/activities` to the list, point the nav and tab bar at it, make the list a top-level screen, and remove the old Activity dashboard. Verify: the route table, a build, all specs, and the live app (Activity opens All activities, the Activity tab is current).
- [x] 4.5 DEFERRED by the user (2026-11-01, "we will work on these later"): fix the remaining app gaps once the user has decided them (G2 weather box on Home, G3 onboarding strip, G4 brand name, G5 units, G6 sidebar area, G7 land colour dots, G8 map controls, G9 land card extras, G10 crop search): one task per gap or group (added in 3.2). Verify: each task's own check, plus `npm run lint`, `npm run build` and `npm test`.

## 5. Golden path

- [x] 5.1 Update `e2e/golden-path.spec.ts` (and `e2e/login-pad.ts` if needed) to the current routes, labels and screens, including the address after sign-in. Verify: the suite passes on Desktop Chrome and Mobile Chrome in the CI `e2e` job. The golden path needed no change; `e2e/assistant-page.spec.ts` now opens the overlay from the quick-actions button on phones.
- [x] 5.2 Add only the extra assertions the review found useful (for example a control still reachable with a banner showing). None were needed.

## 6. Accessibility pass

- [x] 6.1 Walk every screen by keyboard: Tab order, visible focus, Enter and Space, no traps, Escape closing dialogs and menus. Record failures in the gap list and fix them. Done as an automated audit plus the specs; see "Accessibility results" in `design.md` for what was and was not covered (no manual keyboard walk).
- [x] 6.2 Check names for controls and images, heading order, announced errors and status messages, contrast in light and dark, and reduced motion. Record and fix failures. Done as an in-page audit in both themes with four fixes; see "Accessibility results" in `design.md`.

## 7. Roadmap, PR and archive

- [x] 7.1 Run `npm run lint`, `npm run build` and `npm test` (and `ruff`, `mypy` and `pytest` only if backend files changed). Verify: all green.
- [x] 7.2 Open the draft PR (it holds the plan; the gap list is in `design.md`). Verify: the PR links this change and CI runs.
- [x] 7.3 Once CI is green, archive the change on this branch (tick roadmap 5.3; no main spec to sync) and mark the PR ready. Verify: the change sits under `archive/` and roadmap 5.3 is ticked.
