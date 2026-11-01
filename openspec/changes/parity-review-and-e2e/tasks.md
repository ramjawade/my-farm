# Tasks

One PR on `claude/feature-parity-review-and-e2e`. UX source: `design/prototype/myfarm-prototype.html` and `design/prototype/myfarm-design-system.html`. Load the `angular-best-practices` skill before writing any frontend code. The gap list lives in `design.md` ("Gap list"); fix tasks are added after the checkpoint in section 3.

## 1. Set up the review

- [x] 1.1 Use the deployed API (decided) and a farmer the user signs in as in the review app, who has lands, crops, activities, expenses, sales and prices. Verify: the signed-in app shows that farmer's data.
- [x] 1.2 Capture the prototype screens with a throwaway headless Playwright script (kept in the scratchpad, not committed) and the app screens in the Browser pane at 1280 px and 390 px (the pane carries the user's sign-in; a script cannot). Verify: both images exist for a screen.

## 2. Review, screen by screen

Each task compares the prototype with the app on desktop and phone, including empty, loading and error states where the prototype shows them, and adds every difference to the gap list in `design.md` classified as app gap, prototype gap or accepted. Verify per task: every screen in the group appears in the gap list as "matches" or with its differences.

- [ ] 2.1 Sign-in and profile (login, profile).
- [ ] 2.2 Home (cards, banners).
- [ ] 2.3 Lands (list, draw and save a land).
- [ ] 2.4 Crops (list, add, detail).
- [ ] 2.5 Activity (log, add, expense, detail).
- [ ] 2.6 Reports.
- [ ] 2.7 Prices (list, detail, My APMCs, watchlists).
- [ ] 2.8 Assistant (page and overlay).
- [ ] 2.9 System states and banners (404, could not load, loading, offline, the four banner kinds).
- [ ] 2.10 Weather and price alerts: record as known gaps only.

## 3. Checkpoint

- [ ] 3.1 Show the user the gap list and agree the classification, including every prototype gap. Verify: the user's decisions are written into `design.md`.
- [ ] 3.2 Add the fix tasks for the agreed app gaps to this file (through `/opsx:update`), and split into separate changes if the user asks. Verify: `openspec validate` passes and each fix task names its screen and how it is verified.

## 4. Fix the app gaps

- [ ] 4.1 Fix the app gaps agreed in 3.1, one task per gap or screen group (added in 3.2). Verify: each task's own check, plus `npm run lint`, `npm run build` and `npm test`.

## 5. Golden path

- [ ] 5.1 Update `e2e/golden-path.spec.ts` (and `e2e/login-pad.ts` if needed) to the current routes, labels and screens, including the address after sign-in. Verify: the suite passes on Desktop Chrome and Mobile Chrome against a local backend, or in the CI `e2e` job.
- [ ] 5.2 Add only the extra assertions the review found useful (for example a control still reachable with a banner showing). Verify: they pass on both projects.

## 6. Accessibility pass

- [ ] 6.1 Walk every screen by keyboard: Tab order, visible focus, Enter and Space, no traps, Escape closing dialogs and menus. Record failures in the gap list and fix them. Verify: a re-walk of each fixed screen.
- [ ] 6.2 Check names for controls and images, heading order, announced errors and status messages, contrast in light and dark, and reduced motion. Record and fix failures. Verify: a re-check of each fixed screen; automatable name checks added to the golden path where cheap.

## 7. Roadmap, PR and archive

- [ ] 7.1 Run `npm run lint`, `npm run build` and `npm test` (and `ruff`, `mypy` and `pytest` only if backend files changed). Verify: all green.
- [ ] 7.2 Open the draft PR (it holds the plan; the gap list is in `design.md`). Verify: the PR links this change and CI runs.
- [ ] 7.3 Once CI is green, archive the change on this branch (tick roadmap 5.3; no main spec to sync) and mark the PR ready. Verify: the change sits under `archive/` and roadmap 5.3 is ticked.
