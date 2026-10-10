# Tasks

## 1. Apply the theme before first paint and keep it in sync

- [x] 1.1 Add to `projects/home/src/index.html` a small inline script in `<head>` (before the stylesheet) that reads `my_farm_theme` in a `try/catch`, falls back to `prefers-color-scheme`, and sets `data-bs-theme` and the `theme-color` meta; add `<meta name="color-scheme" content="light dark">` and a `theme-color` meta
- [x] 1.2 Add `core/theme/theme.service.ts`: `preference`, `systemDark` and computed `resolved` signals; `setPreference()` saving to `localStorage` in a `try/catch`; one effect writing `data-bs-theme` and `theme-color` (from `cssColor('--mf-bg')`); a `matchMedia` change listener and a `storage` event listener
- [x] 1.3 Add `provideThemeInitializer()` and register it in `app.config.ts` next to the language initializer
- [x] 1.4 Add `color-scheme: light` to the light token block in `_tokens.scss` (dark already has `color-scheme: dark`)
- [x] 1.5 Keep `my_farm_theme` in `legacy-storage-cleanup.ts` (it runs from `main.ts` on every start and deletes unknown `my_farm_*` keys) and cover it in its spec

## 2. Theme setting in Profile

- [x] 2.1 Add a Theme row to the Account Information card in `profile.component.html` (under Language) using the `.seg` control with three buttons, `aria-pressed`, applying on click via `ThemeService`
- [x] 2.2 Add `profile.theme`, `theme.system`, `theme.light` and `theme.dark` to `public/i18n/en.json`, `hi.json` and `mr.json`

## 3. Parts that do not follow CSS on their own

- [x] 3.1 Make the `history-trend` chart effect also read `ThemeService.resolved()` so it rebuilds with fresh token colours when the theme changes
- [x] 3.2 Add `styles/components/_leaflet.scss` (imported in `_design-system.scss`) overriding Leaflet zoom buttons, attribution, popups, popup tip and layer control with surface, line and text tokens
- [x] 3.3 Check native controls (date input, select, scrollbar) draw dark when the theme is dark, and fix any that stay bright

## 4. Tests and checks

- [x] 4.1 Unit spec `theme.service.spec.ts`: default is Same as phone; a saved value is used; Same as phone follows a media-query change but Light/Dark do not; a storage failure does not throw; a `storage` event updates the preference; `data-bs-theme` and `theme-color` are written
- [x] 4.2 Unit spec for the Profile Theme row: shows three options, marks the current one, calls `setPreference` on click
- [x] 4.3 Headless run over login, home, crops, activities (dashboard, list), weather, profile, reports, map and not-found in both themes at 1280 px and 375 px: no bright patches in dark, no unreadable text, no overflow; look at the screenshots, including the weather chart, map controls and the confirm dialog
- [x] 4.4 Check reload shows no flash (the first painted frame is already dark) and that Same as phone follows a media-query change while the page is open
- [x] 4.5 Run `npm run lint` (includes `lint:colors`), `npm run format:check`, `npm run build` and `npm test` (home and shared); CI runs the Playwright golden path

## 5. Wrap-up

- [x] 5.1 After the PR merges, archive this change and tick task 1.2 in `prototype-adoption-roadmap/tasks.md`
