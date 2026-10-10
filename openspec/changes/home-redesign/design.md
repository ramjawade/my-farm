## Context

`HomeComponent` (`features/home/`, about 310 lines of TS and 510 of HTML) renders the signed-out landing page and, when signed in, a welcome banner, four stat cards, a weather card, a crops monitor, recent activity and the onboarding checklist. It already loads lands (`FarmDrawService.loadFarms`), weather (`IWeatherService`, location from the first land or the profile) and reads crops (`CropTimelineService`) and activities (`ActivityService`). The prototype's `home()` builds the new screen from `kpis()`, `farmCard()`, `todayCard()`, `wxToday()` and `attnCard()`.

## Goals / Non-Goals

**Goals:** match the prototype's signed-in Home on desktop and phone using data the app already has.

**Non-Goals:** the signed-out landing page, the daily brief card, price-alert banners, backend changes, changing how weather is fetched.

## Decisions

1. **Split the screen.** The signed-in view becomes small presentational components under `features/home/`: `HomeKeyTilesComponent`, `HomeWeatherCardComponent`, `HomeAttentionCardComponent`, `HomeTodayCardComponent`, `HomeFarmCardComponent`. `HomeComponent` keeps the data lifecycle and the landing page, and passes each card what it needs through `input()`/`output()`. This keeps each template short and testable.
2. **One pure helper for the numbers.** `home-summary.ts` exports functions over plain data: `keyTiles(crops, lands, expenses, now)`, `attentionItems(activities, crops, now)`, `todayItems(activities, now)`, `nextHarvest(crops, now)`, and `greetingFor(hour)`. They take the already-loaded signals' values so they are easy to unit-test with fixed dates and are the one place for the rules (two-day window, 7-day idle limit, four-item cap).
3. **Season spend** sums expenses of activities in the current season (`seasonForDate`), and "since" shows that season's first day (Kharif 1 June, Rabi 1 November, Zaid 1 April).
4. **Today and completion.** "Planned for today" means status not Completed or Cancelled with a date on today's calendar day. The checkbox calls the existing `completeActivity` on `CropTimelineService`/`ActivityService` and the card reads the same signal, so it updates at once; no new request pattern.
5. **Attention badges** use the prototype's tones: overdue in the danger tone, due soon in the warning tone, idle crops neutral. Rows open `/activities/:id` or `/crops/:id`.
6. **Weather card** reuses the existing signals (`currentWeather`, `weatherIsSample`, `weatherLocation`). The three-day row shows only when the weather data holds daily forecast entries; otherwise the card shows the current conditions only. Humidity and wind come from the current-conditions fields the card already shows.
7. **Layout with Bootstrap.** Desktop uses a two-column grid with the left and right stacks; the phone order is set with flex `order` utilities on the cards (one DOM order, reordered by breakpoint) so there is no duplicated markup. Page padding and card spacing follow the Lands and Crops pages (cards unpadded wrappers, 12px gaps).
8. **Avatar** on phones reuses the initial logic from Profile and links to `/profile`.
9. **Onboarding checklist** stays below the cards, unchanged, until the roadmap decides otherwise.
10. **Translation.** New strings in mr, hi and en; the completeness check stays green.

## Risks / Trade-offs

- Unused old strings and styles (`home.*` keys, welcome-card CSS) remain until a later cleanup so the landing page keeps working.
- The farm card shows the first land's crops, since Home has no selected land; with several lands it lists the crops across lands, two at a time, with View all to Crops.
- The weather forecast row depends on data that may be missing in sample mode; the card degrades to current conditions.

## Migration Plan

Frontend only; no data changes.

## Open Questions

- Should the onboarding checklist stay on Home? Assumed yes until decided.
