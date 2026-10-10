## Why

Home is the first screen a signed-in farmer sees, and it still uses the old welcome banner and card styles. The prototype gives it a clear shape: a greeting with the avatar, four key numbers, today's weather, what needs attention, today's work and a short view of the farm. Profile, Lands and Crops are already in the new style, so Home is now the odd one out.

## What Changes

- Header: "Good morning, <first name>" (or afternoon, evening) with a line of date, temperature and conditions. On a phone the avatar sits to the left and opens Profile. On desktop a "+ Log activity" button sits on the right.
- Four key tiles: Active crops ("across N lands"), Total area (with the village or district), Season spend ("since" the season start) and Next harvest (days and crop).
- Today's weather card: temperature, conditions, humidity and wind, a "Full forecast" link; a short three-day row when the forecast is available. A clear note when the weather is sample data or no location is set.
- Needs attention card: activities overdue or due within two days, and crops with no activity for 7 days or more; at most four rows, each opening the activity or crop; an "All clear" row when there is nothing.
- Today card: the activities planned for today with a checkbox that marks one done, and "x of y done" with a progress bar.
- Your farm card: the land's crops (two shown, with "View all") with icon, age, the four-step stage bar, days to harvest and expenses.
- Layout: two columns on desktop (farm and today on the left, weather and attention on the right), one column on a phone ordered weather, attention, today, farm.
- Removed from Home: the old welcome banner and the old stat, crops monitor and recent activity cards.
- Left as they are: the signed-out landing page, and the onboarding checklist for new farmers (the prototype has none; it stays until the roadmap says otherwise).
- Out of scope: the daily brief card (no design yet), price-alert banners (`price-alerts-and-watchlist`), and the market, reports and activity screens.

## Capabilities

### New Capabilities
- `home-screen`: the signed-in Home screen: greeting, key tiles, weather, needs attention, today and your farm.

### Modified Capabilities
- none

## Impact

- Frontend: `features/home/` (template and component rewritten, a small pure helper for the numbers), i18n keys for mr/hi/en, specs, Playwright golden path if it reads Home text.
- Backend: none.
