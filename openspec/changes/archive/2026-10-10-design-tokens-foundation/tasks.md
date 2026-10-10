# Tasks

## 1. Tokens and Bootstrap mapping (PR 1)

- [x] 1.1 Add `projects/home/src/styles/_tokens.scss` with the `--mf-*` tokens: colours (light on `:root`, dark on `[data-bs-theme="dark"]`, values from the prototype) with `-rgb` channel tokens for leaf, sun, sky, rose and fg; data tokens `--mf-type-*` (12 activity types), `--mf-temp-*`, `--mf-chart-1…6`, `--mf-map-*`; `--mf-scrim`; spacing `--mf-s-1…6`, radius `--mf-r-*`, shadows, z-layers, `--mf-dur-base`, and font stacks `--mf-font-display` and `--mf-font-body`
- [x] 1.2 Rewrite `_bootstrap-variables.scss`: `$primary`, `$success`, `$warning`, `$info`, `$danger`, `$body-bg`, `$body-color`, `$border-color`, `$link-color` set to the prototype light hex; fonts; `$font-size-base: .875rem` and the heading scale; the radius map. Keep `$spacers` unchanged
- [x] 1.3 Turn the legacy `$farm-*`, `$soil-*`, `$light-mint`, `$border-mint`, `$body-dark-slate`, `$temp-*`, `$farm-humidity` and `$farm-wind` variables into temporary aliases of the new palette (deleted in 4.6)
- [x] 1.4 In a new `_bootstrap-bridge.scss` (imported after Bootstrap), re-point the Bootstrap runtime properties (`--bs-body-bg`, `--bs-body-color`, `--bs-border-color`, `--bs-primary` and `-rgb`, `--bs-link-color`, `--bs-*-bg-subtle` and `--bs-*-text-emphasis`) to `var(--mf-*)`; import `_tokens.scss` first and the bridge after Bootstrap in `styles.scss`

## 2. Typography (PR 1)

- [x] 2.1 Add preconnect and Google Fonts links (Bricolage Grotesque 500/700, Figtree 400–700, Mukta 400–700, `display=swap`) to `projects/home/src/index.html`; delete the Outfit `@import` from `_design-system.scss`
- [x] 2.2 Replace `Outfit` in all 14 files (global partials, feature SCSS, `history-trend.component.ts`, the shared `confirm-dialog`) with the token font stacks or inherit; confirm `grep -r Outfit projects` returns nothing outside `node_modules`
- [x] 2.3 Keep form controls at 16 px below 576 px, so iOS does not zoom on focus

## 3. Shared component styles (PR 1)

- [x] 3.1 Rewrite `_buttons.scss`: default, primary, warning, danger and link to the design system; 8 px corners, semibold, no gradients, no hover lift; visible `:focus-visible` ring
- [x] 3.2 Rewrite `_cards.scss`: flat surface, line border, 12 px corners, 16 px padding, display-font titles; remove the `glass-card`/`card-glass` blur and the hover lift (keep the class names as plain cards so templates still render)
- [x] 3.3 Rewrite `_badges.scss`: soft pill tones `.badge-soft-{success|warning|info|danger|muted}`; map existing badge classes used in templates onto them
- [x] 3.4 Rewrite `_forms.scss`: semibold muted 12 px label, 8 px control corners, leaf focus ring, muted help text, rose invalid state wired to `.is-invalid` and `.invalid-feedback`
- [x] 3.5 Add `_chips.scss` (`.chip`, selected via `aria-pressed="true"`), `_segmented.scss` (`.seg`), `_empty-state.scss` (`.empty-state` with `__icon`, `__title`, `__text` and `__action`) and `_sheet.scss`; import them in `_design-system.scss`
- [x] 3.6 Update `_layout.scss` and `_animations.scss` to use tokens (page background, sidebar and toolbar surfaces); no structural layout changes
- [x] 3.7 `projects/shared` toast: styles use `var(--mf-*, fallback)` with success, warning, error and info tints
- [x] 3.8 `projects/shared` confirm-dialog: token surface and 14 px corners; below 576 px a bottom sheet (bottom-anchored, full width, 18 px top corners, slide-up); check that focus trap and Escape still work
- [x] 3.9 Move the existing activity-list empty state onto the shared `.empty-state` pattern, as the reference use

## 4. Hard-coded colour removal and guard (PR 2)

- [x] 4.1 Add `scripts/check-colors.mjs` (hex, `rgb()`/`rgba()`/`hsl()` literals and named colours outside comments; skips specs, `generated/`, `node_modules`; allow-list `_tokens.scss`, `_bootstrap-variables.scss`, `index.html` theme-color, `manifest.webmanifest`); add `lint:colors` and chain it into `npm run lint`; run it to produce the baseline list
- [x] 4.2 Global partials and component SCSS: replace every literal and legacy Sass colour with `var(--mf-*)` (map, login, crop-activity, home, activity dashboard and list, saved-farms, sun-path, chat, profile, weather, land-detail and the rest from the baseline)
- [x] 4.3 Templates: replace the 16 inline `style=` colours and 8 `[style.*]`/`[ngStyle]` colour bindings with tone classes (`.tone-*`) or class bindings
- [x] 4.4 TypeScript colour maps: `activity-display.ts` (activity-type tones), profile crop options, weather alert, advisory and history-trend, workflow prompt card and progress bar, chat panel, review popup and container, create-activity, loader; return tone keys or token names and bind them as classes
- [x] 4.5 Map: `farm-draw-layer.ts` and `layer-toggle-control.ts` use `var(--mf-map-*)` in Leaflet options and control styles (Leaflet resolves `var()` in SVG paths, verified headless); `core/theme/css-token.ts` resolves tokens for the Chart.js weather chart
- [x] 4.6 `projects/shared` combobox, loader, toast and confirm-dialog: no literals left; delete the legacy Sass colour aliases from `_bootstrap-variables.scss`
- [x] 4.7 `npm run lint:colors` reports zero findings; add a test fixture or a self-check proving it flags `#3182ce` and `rgba(0,0,0,.1)` and ignores `// see #242`

## 5. Verification

- [x] 5.1 After each PR, open every route (home, login, map, crops, crop detail, add crop, activities, activity detail, create activity, weather, profile, reports, not-found) at 1280 px and 375 px; fix only unreadable text, invisible borders, overflow or clipping; list deferred visual mismatches in the PR description for the screen changes
- [x] 5.2 Check Marathi and Hindi text renders in Mukta (switch language in Profile)
- [x] 5.3 Run `npm run lint` (includes `lint:colors`), `npm run build` and `npm test`; run the Playwright golden path (`npm run e2e`)
- [x] 5.4 After both PRs merge, archive this change and tick task 1.1 in `prototype-adoption-roadmap/tasks.md`
