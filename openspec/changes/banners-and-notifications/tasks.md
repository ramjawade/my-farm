# Tasks

One PR on `claude/feature-banners-and-notifications`. Frontend only. UX source: `design/prototype/myfarm-prototype.html` (Home, and the Banners card on "System states") and the Banners section of `design/prototype/myfarm-design-system.html`, both approved and committed on this branch. Load the `angular-best-practices` skill before writing components.

## 1. Banner service

- [ ] 1.1 Add `BannerService` (`core/services/`): `register`, `unregister`, and an `active` computed (current screen, not dismissed, sorted Problem, Warning, Update, New, then insertion order), plus `dismiss(id)` that is ignored for Problem. Dismissals are stored per farmer in `localStorage` keyed by id + title + text, with an in-memory fallback. Verify: service spec for ordering, screen scope, `'*'`, dismissal surviving a new service instance, a changed text showing again, Problem not dismissable, another user id not inheriting dismissals, and storage that throws.

## 2. Banner and host

- [ ] 2.1 Add `app-banner` with the four kinds (chip tint, icon, label, title, line, optional link action, dismiss button except for Problem, rose border and `role="alert"` for Problem). Verify: component spec per kind for label, role and presence of the dismiss button; the dismiss button's accessible name includes the title; Enter on it dismisses.
- [ ] 2.2 Add `app-banner-host`: first two active banners, the "N more notifications" row (singular and plural) with "View all" and "Show less", folded again on navigation. Place it in `app-main` above the router outlet, and above the router outlet in the signed-out branch of `app-layout`. Verify: spec for two shown of four, "2 more notifications", expand to four and fold back, a Problem first, and presence in both branches.
- [ ] 2.3 Add the `banners.*` strings for en, hi and mr (labels, "N more" plurals, View all, Show less, Dismiss, update and weather notice text). Verify: `npm run lint` (translation check) passes.

## 3. First notices

- [ ] 3.1 Register the offline notice from `ConnectionService.online` as a Problem banner on every screen and delete the old `app-offline-banner` component, moving its spec cases. Verify: specs that it shows offline, disappears online, has no dismiss button and shows signed in and signed out.
- [ ] 3.2 Weather: register the sample-data Update banner while `source() === 'demo'` and remove the `alert alert-warning` block. Verify: weather spec that the banner shows for demo data and not for live data, and shows only on Weather.
- [ ] 3.3 Add the "New version available" Update banner on Home from `SwUpdate.versionUpdates`, with "Update now" activating the update and reloading. Verify: spec with a mocked `SwUpdate` that a ready event registers it, that dev (service worker off) shows nothing, and that "Update now" activates and reloads.

## 4. Roadmap, PR and archive

- [ ] 4.1 Run `npm run lint`, `npm run build` and `npm test`; update the Playwright golden path only if it reads changed text. Verify: all green.
- [ ] 4.2 Open the draft PR (it holds the prototype, design system and plan). Verify: the PR links this change and CI runs.
- [ ] 4.3 Once CI is green, archive the change on this branch (sync the new `banners` spec, tick roadmap 5.1, note in 5.2's text that its offline banner now uses the shared banner) and mark the PR ready. Verify: `openspec/specs/banners/spec.md` exists and the change sits under `archive/`.
