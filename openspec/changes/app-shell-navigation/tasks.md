# Tasks

## 1. Route metadata, titles and page state

- [x] 1.1 Add `layout/nav/nav-items.ts` with the typed `NAV_ITEMS` list (Home, Lands, Crops, Activity, Reports, Weather; Weather without a phone tab) and a `userInitials()` helper (extracted from the toolbar) with a spec
- [x] 1.2 Add `title` (translation key) and `data: { section, parent? }` to every route in `app.routes.ts`: top-level sections, `crops/add`, `crops/:cropId` and its `list` and `create` children, `activities` with `list`, `create` and `:id`, `profile`, `reports`, `weather`, and the not-found route (no section)
- [x] 1.3 Add `AppTitleStrategy` (extends `TitleStrategy`): translates the key, sets `document.title` to `"<title> · My Farm"`, re-applies on language change; provide it in `app.config.ts`
- [x] 1.4 Add `PageMetaService`: from `NavigationEnd` expose `titleKey`, `section` and `parentUrl` (param tokens such as `:cropId` filled from the route params)
- [x] 1.5 Add `shell.*` strings (skip link, navigation labels, open profile, back, page titles such as add crop, crop detail, log activity, activity detail, not found) and `profile.signOut` to `en.json`, `hi.json` and `mr.json`

## 2. Desktop sidebar

- [x] 2.1 Rebuild `layout/sidebar` as the desktop frame: logo and app name, the items from `NAV_ITEMS` with `aria-current="page"` from `PageMetaService.section`, and the account block (initials, name, village or district and area) linking to `/profile`; labelled `<nav>`; shown at 992 px and up only
- [x] 2.2 Style it with Bootstrap utilities and the tokens (surface, line, leaf-soft active state, 44 px touch targets), no hard-coded colours

## 3. Phone tab bar and header

- [x] 3.1 Add `layout/tab-bar`: the `phoneTab` items from `NAV_ITEMS` as a labelled `<nav>`, icons with short labels, current tab highlighted and exposed; bottom safe-area padding; shown under 992 px only
- [x] 3.2 Add `layout/mobile-header`: back arrow to `parentUrl` when there is one, otherwise the logo (28 px mark); the translated page title; the avatar button to `/profile`; shown under 992 px only
- [x] 3.3 Add a "Skip to content" link as the first focusable element, focusing `#main-content`

## 4. Layout and cleanup

- [x] 4.1 Rebuild `layout/app-layout`: grid (sidebar | main on wide screens; header, main, tab bar on phones), `--mf-tabbar-h`, `#main-content` landmark, no backdrop or sidebar toggle state; keep the chat button, toast and loader outlets
- [x] 4.2 Offset `.fab`, `.fab-button`, `.fab-soft`, `.fab-stack-*` and `.chat-fab` by `var(--mf-tabbar-h, 0px)` under 992 px in `_buttons.scss`; check `main.scss`'s phone bottom padding still clears the tallest button stack
- [x] 4.3 Add a Sign out button (`btn btn-outline-danger`, full width) at the bottom of Profile calling `AuthService.logout()`
- [x] 4.4 Delete the toolbar (`toolbar.ts`, `.html`, `.scss`, `.spec.ts`) and the translation keys only it used

## 5. Tests and checks

- [x] 5.1 Unit specs: `AppTitleStrategy` (title, language change), `PageMetaService` (section, parent with params, not-found), a route-table spec that fails if a route lacks a title or section (404 excepted)
- [x] 5.2 Component specs: sidebar (items in order, current item, account block), tab bar (five tabs, current), mobile header (back arrow vs logo, title, avatar link), Profile sign out
- [x] 5.3 Headless check of the production build at 1280 px and 375 px, light and dark: every route shows the right title in the tab, header and highlighted item; back arrows go to the right parent (including `:cropId`); the tab bar never covers content or floating buttons (look at crop detail, activity detail and the map); the skip link works; keyboard Tab order is sensible; no overflow; look at the screenshots
- [x] 5.4 Run `npm run lint`, `npm run format:check`, `npm run build` and `npm test` (home and shared); CI runs the Playwright golden path

## 6. Wrap-up

- [ ] 6.1 After the PR merges, archive this change and tick task 1.4 in `prototype-adoption-roadmap/tasks.md`
