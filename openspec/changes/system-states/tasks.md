# Tasks

One PR on `claude/feature-system-states`. Frontend only. UX source: `design/prototype/myfarm-prototype.html` (screen "System states") and the States section of `design/prototype/myfarm-design-system.html`, both approved and committed on this branch. Load the `angular-best-practices` skill before writing components.

## 1. Offline notice

- [ ] 1.1 Add `ConnectionService`: a readonly `online` signal from `navigator.onLine`, updated by the window `online` and `offline` events and cleaned up on destroy. Verify: service spec that dispatching `offline` then `online` flips the signal, and that the initial value follows `navigator.onLine`.
- [ ] 1.2 Add `app-offline-banner` (label "Offline", title, line, `role="alert"`, no close button, hidden while online) and place it at the top of the content in `app-main` and above the router outlet in the signed-out branch of `app-layout`. Verify: component specs that it shows offline, disappears online, has no close button, and shows in both branches.
- [ ] 1.3 Add the offline strings for en, hi and mr. Verify: `npm run lint` (translation check) passes.

## 2. Loading and could not load

- [ ] 2.1 Add `app-page-loading` (spinner, "Loading…", one line, `role="status"`) and `app-load-error` (icon, title, line, primary "Try again", `retry` output) on the `.empty-state` pattern, with en, hi and mr strings. Verify: specs that each renders its text, that the loading card is a status, and that `retry` fires on click and on Enter.
- [ ] 2.2 Replace the activity page's error box with `app-load-error` wired to its `reload`. Verify: spec that a failed load shows the card and that "Try again" reloads and shows the activity on success.
- [ ] 2.3 Replace the full-page spinners of activity detail, crop dashboard, activity dashboard, activity list, prices list, price detail and My APMCs with `app-page-loading`. Verify: each page's spec asserts the card while loading; any page whose markup does not fit keeps its spinner and is named in the PR.

## 3. Page not found and overlay

- [ ] 3.1 Rebuild `NotFoundComponent` on `.empty-state` with the new wording and a "Go to Home" link, remove its scoped CSS, and update the `notFound.*` strings in en, hi and mr. Verify: spec for the title, line, link target and that no old wording remains.
- [ ] 3.2 Give `LoaderOutletComponent` a `label` input (default "Loading...") and token-based styling, and pass the translated `common.loading` from `app-layout`. Verify: shared-library spec for the label, and an app spec that the overlay shows the translated text.

## 4. Roadmap, PR and archive

- [ ] 4.1 Run `npm run lint`, `npm run build` and `npm test`; update the Playwright golden path only if it reads any changed text. Verify: all green.
- [ ] 4.2 Open the draft PR (it holds the prototype, design system and plan). Verify: the PR links this change and CI runs.
- [ ] 4.3 Once CI is green, archive the change on this branch (sync the new `system-states` spec, tick roadmap 5.2) and mark the PR ready. Verify: `openspec/specs/system-states/spec.md` exists and the change sits under `archive/`.
