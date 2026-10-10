## Why

The Crops screens still use the old dashboard cards, a long timeline page and an add-crop form without irrigation or farming method. The prototype gives crops a clear list, a detail page built around stage, key numbers and activities, and one form for adding and editing a crop. `profile-settings` already moved irrigation and farming method to the crop in the API, and `lands-redesign` sends farmers here with a land chosen. This change gives those fields their place.

## What Changes

- Crops list: cards with a crop-type icon, name, plot (land), age in days, area, a four-step stage bar and an activity-count badge; an actions menu (Edit crop, Delete crop). Search stays. "No crops yet" empty state with Add crop.
- Crop detail: back link "All crops"; header with the crop name and a line of land, stage, irrigation and farming method; "Log activity"; a Stage card with the four-step bar and the existing "advance stage" action; key tiles (Age, Activities done and planned, Crop cost, Area); an Activities card with All / Upcoming / Recent chips; a Timeline card.
- Add and edit crop in one form: Season, Crop name, Land, Total surface area with unit, Sowing date, optional Irrigation type (Drip, Sprinkler, Flood, Manual) and optional Farming method (Organic, Conventional, Conservation Farming, Natural Farming). Editing opens the same form with the crop's values.
- Crops store and return `irrigation_type` and `farming_method` (already in the API).
- Stages: the app keeps its eight growth stages in data. The screens show four steps by grouping them: Sowing (Land Preparation, Sowing, Germination), Growth (Vegetative Growth), Flowering (Flowering, Fruiting / Pod Formation), Harvest (Maturity, Harvest).
- Out of scope: the sales card and harvest recording (`harvest-and-sale-tracking`), activity types, statuses and the activity form (`activity-types-and-statuses`), and the activity log filters.

## Capabilities

### New Capabilities
- `crops-screen`: the crops list, crop detail, and the add and edit crop form.

### Modified Capabilities
- none

## Impact

- Frontend: `features/crop-timeline/` (dashboard, crop-activity, add-crop restyled; edit route added), `CropEntity`, `crop-mapper.service.ts`, `CropTimelineService.updateCrop` use, i18n keys for mr/hi/en, specs, Playwright golden path if it touches the add-crop form.
- Backend: none.
