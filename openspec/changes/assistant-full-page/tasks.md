# Tasks

One frontend PR (no backend change). Applying starts after the user approves issue #387 and this change.

## 1. Shared conversation

- [x] 1.1 Provide `ChatOrchestratorService` on the app layout instead of the container, and add a review-requested signal to it; point the container at that signal. Verify: existing container and orchestrator specs pass; a new spec shows two injectors get the same instance.
- [x] 1.2 Give new messages a `createdAt` when appended. Verify: orchestrator spec.

## 2. Page and entry points

- [x] 2.1 Add the `assistant` nav item (sidebar only) and the `chat` route (auth-guarded, lazy, titled) with the page component hosting the panel. Verify: nav-items and shell specs; route renders the panel.
- [x] 2.2 Hide the floating button on `/chat`, add the expand button to the overlay header, and close the overlay when expanding. Verify: container spec for each scenario.
- [ ] 2.3 Make the page fill the content area on desktop and phone (composer above the tab bar). Verify: checked on a desktop and a phone-sized viewport.

## 3. Look

- [x] 3.1 Add the `layout` input to `ChatPanelComponent` and restyle it: header with leaf avatar and subtitle, avatar bubbles, times, brief as separate lines, thinking dots, send icon, standing suggested-question row. Verify: panel specs for the spec scenarios (brief lines, waiting state, tapping a suggestion).
- [x] 3.2 Add i18n keys (mr, hi, en) and pass `scripts/check-translations.mjs`. Verify: the script.
- [ ] 3.3 Check light and dark themes for page and overlay. Verify: contrast looked at in both themes.

## 4. Finish

- [x] 4.1 Add an e2e check: sidebar to `/chat`, no floating button there, the overlay's expand opens the page. Verify: `npm run e2e` locally against a backend, and CI.
- [x] 4.2 Run `npm run lint`, `npm run build`, `npm test` and the Prettier check.
- [ ] 4.3 Open the PR with `Fixes #387 #301`; once CI is green, archive this change (adds the `assistant-full-page` spec), tick task 4.4 in `prototype-adoption-roadmap/tasks.md`.
