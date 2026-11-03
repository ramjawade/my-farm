# Tasks

One PR on this branch. Frontend only. UX source: `design/prototype/myfarm-prototype.html` (screen "System states", "Slow start" card) and the States section of `design/prototype/myfarm-design-system.html`, both approved and committed on this branch. Load the `angular-best-practices` skill before writing code.

## 1. Slow flag in the loader service

- [x] 1.1 Add a readonly `slow` signal to `LoaderService`: a 3-second timer starts when loading begins for the first time and sets `slow`; it is cleared and `slow` reset when loading first ends; the timer never starts again. Verify: service spec with the fake clock for before and after 3 seconds, a fast load, a second load after the first, and overlapping requests.

## 2. Show the line in the overlay

- [x] 2.1 Add the optional `slowNote` input to `LoaderOutletComponent` and render it as a muted line inside the status card while `slow()` is true. Verify: shared-library spec that the note shows only when `slow` is true and a note is given.
- [x] 2.2 Add `states.loading.slow` for en, hi and mr and pass it from `app-layout`. Verify: `npm run lint` (translation check) passes, and an app-layout spec shows the translated line when the loader is slow.

## 3. Check, PR and archive

- [x] 3.1 Run `npm run lint`, `npm run build` and `npm test`; update the Playwright golden path only if it reads the overlay text. Verify: all green.
- [x] 3.2 Open the draft PR (it holds the prototype, plan and code). Verify: the PR links this change and issue #404, and CI runs.
- [x] 3.3 Once CI is green, archive the change on this branch (sync the `system-states` spec) and mark the PR ready. Verify: `openspec/specs/system-states/spec.md` has the Slow start message requirement and the change sits under `archive/`.
