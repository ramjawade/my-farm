## 1. Numbers

- [x] 1.1 Add `home-summary.ts` with `greetingFor`, `keyTiles`, `nextHarvest`, `attentionItems` (two-day window, 7-day idle, cap of four) and `todayItems`, with specs on fixed dates
- [x] 1.2 Season start date helper and season spend from expenses, with specs

## 2. Cards

- [x] 2.1 `HomeKeyTilesComponent` (four tiles) with specs
- [x] 2.2 `HomeWeatherCardComponent`: conditions, humidity, wind, Full forecast link, optional three-day row, sample-data note and no-location state, with specs
- [x] 2.3 `HomeAttentionCardComponent`: badges, rows that open the activity or crop, All clear, with specs
- [x] 2.4 `HomeTodayCardComponent`: checkboxes that complete the activity, "x of y done" and progress bar, empty state, with specs
- [x] 2.5 `HomeFarmCardComponent`: crop rows with icon, age, stage bar, days to harvest and expenses; Showing N of M and View all; Add crop when empty, with specs

## 3. Screen

- [x] 3.1 Rework the signed-in part of `HomeComponent`: header with greeting, date and weather line, phone avatar to Profile, desktop Log activity button
- [x] 3.2 Two-column desktop layout and the phone order (weather, attention, today, farm) with Bootstrap order utilities; spacing as on Lands and Crops
- [x] 3.3 Remove the old welcome banner, stat, crops monitor and recent activity markup; keep the landing page and the onboarding checklist working
- [x] 3.4 Update `home.component.spec.ts` for the new screen

## 4. Strings and wrap up

- [x] 4.1 mr, hi and en strings; keep the translation check green
- [x] 4.2 Update the Playwright golden path if it reads Home text
- [x] 4.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [ ] 4.4 Open the PR naming `home-redesign`
- [ ] 4.5 After the PR merges, archive this change and tick task 3.1 in `prototype-adoption-roadmap/tasks.md`
