# Tasks

Each task is one child change: run `/opsx:propose`, get approval, apply it, merge the PR, run `/opsx:archive`, then tick the task here. The prototype screen each child implements is in brackets.

## 1. Phase 0: Foundation

- [x] 1.1 `design-tokens-foundation`: map the prototype colour, type, spacing, radius and shadow tokens onto Bootstrap variables; replace the Outfit "premium" theme; restyle the shared buttons, cards, badges, chips, segmented control, fields, toast, the dialog/bottom sheet and the empty state; remove every hard-coded colour and add a lint guard so none come back (two PRs) [design system: Foundations, Components]
- [x] 1.2 `light-dark-theme`: both palettes as Bootstrap colour modes, Theme setting (System / Light / Dark) under Profile → App, applied before first paint, check every route in both themes [prototype: profile → Theme; design system: theme toggle]
- [x] 1.3 `brand-logo`: leaf logo assets, a simplified mark for 32 px and below, favicon, PWA manifest icons [design system: Brand]
- [ ] 1.4 `app-shell-navigation`: desktop sidebar, phone bottom tabs, header with the avatar opening Profile, route `title`/`parent` data for titles and the back button [prototype: shell on every screen]
- [ ] 1.5 `marathi-language-switching`: Marathi is already supported and fully keyed, so this is the Marathi-first work: default language, a switch on login and in Profile, about 140 hard-coded English strings translated, farmer vocabulary from the prototype glossary, Marathi/Hindi dates and Indian number grouping, `<html lang>`, and a translation completeness check [prototype: language toggle, TR tables]

## 2. Phase 1: Account

- [ ] 2.1 `warli-login-registration`: Warli scene, the "राम राम मंडळी 🙏" greeting, phone + PIN sign-in, registration [prototype: login]
- [ ] 2.2 `profile-settings`: settings-row list, edit dialog (centred on desktop, bottom sheet on the phone), move water source to the land and irrigation and farming method to the crop (backend migration), drop primary crops, profile KPIs and GPS [prototype: profile]

## 3. Phase 2: Core farm screens

- [ ] 3.1 `home-redesign`: greeting with the avatar, KPI tiles, weather card, needs-attention list [prototype: home]
- [ ] 3.2 `lands-redesign`: land cards with the map outline, water source, Fallow badge, "Nothing growing" empty state with Add crop [prototype: lands]
- [ ] 3.3 `crops-redesign`: crop cards, crop detail, add crop with optional irrigation and farming method [prototype: crops, cropdetail, addcrop]
- [ ] 3.4 `activity-types-and-statuses`: 12 types with icons, 5 statuses that follow the date, action buttons that depend on the status, edit and delete [prototype: addact, actdetail]
- [ ] 3.5 `activity-list-and-filters`: activity log after the KPIs, collapsible filter bar with a count badge, chips in the same row, Clear [prototype: log]
- [ ] 3.6 `expenses-redesign`: add/edit expense flow and list styling [prototype: addexp]

## 4. Phase 3: New features

- [ ] 4.1 `harvest-and-sale-tracking`: fill in the existing empty change; record harvests and sales against a crop, income roll-ups [prototype: addsale, cropdetail]
- [ ] 4.2 `market-prices`: explore the data source first; price list, price detail, APMC picker [prototype: prices, pricedetail, apmcs]
- [ ] 4.3 `price-alerts-and-watchlist`: watchlists, add watch item, price alerts [prototype: alerts, addalert, newwl, addwi]
- [ ] 4.4 `assistant-full-page`: assistant screen, greeting with brief bullets, suggested questions, review-and-save of logged entries [prototype: chat]
- [ ] 4.5 `weather-redesign`: today card, forecast, farming advisories in the new style [prototype: weather]
- [ ] 4.6 `reports-redesign`: reports by category and month, export, in the new style [prototype: reports]

## 5. Phase 4: Polish and parity

- [ ] 5.1 `banners-and-notifications`: the four banner kinds, stacking (two, then "N more"), dismiss rules [design system: Banners]
- [ ] 5.2 `system-states`: 404, error, offline and loading states in the new style
- [ ] 5.3 `parity-review-and-e2e`: compare each prototype screen with the app (desktop and phone), fix gaps, update the Playwright golden path, accessibility pass
- [ ] 5.4 Update `ROADMAP.md`, then archive this roadmap change
