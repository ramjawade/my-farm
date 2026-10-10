## Why

The Lands screen (`/map`) is a map with a collapsible "saved farms" overlay, and a separate land-detail panel. The prototype turns it into a clear page: a map card that shows the selected land, an "All lands" list with what grows on each land, a two-step save form, and a proper empty state when nothing grows. It also gives water source a home on the land. `profile-settings` already moved the field to the land in the API; farmers have no way to set it until this change.

## What Changes

- Lands page layout: header with the land count and total area; the map card with the selected land's detail under it; the "All lands" list beside it on desktop and below it on the phone. The current floating saved-farms panel and land-detail panel are replaced.
- "All lands" cards: a small outline of the land's boundary, the name, the crop names (or a "Fallow" badge when nothing grows), the area, and an actions menu (Rename, Delete) with the existing delete confirmation.
- Selected-land detail: name with rename, then either
  - "Nothing growing on <land>" empty state with an Add crop button, plus a line of area, water source and notes; or
  - Area, Crops, Total expenses, Cost per acre and Water source, a "View crop details" link and "+ Add another crop".
- Drawing flow: "1 Draw boundary", "2 Add details" step badges, and a Save land form with name, computed area, optional Water source (Borewell, Canal, River, Farm Pond, Rainfed) and notes. After saving, a card says the land is saved and offers Add crop or Not now.
- No lands yet: an empty state with "Draw your first land".
- Water source is read and written on the land (`water_source`).
- Out of scope: the Crops screens (`crops-redesign`), the map drawing tools themselves, and Home.

## Capabilities

### New Capabilities
- `lands-screen`: the Lands page, land cards, selected-land detail, empty states and the save-land flow.

### Modified Capabilities
- `farm-profile-persistence`: none. The land's `water_source` already exists in the API from `profile-settings`; this change only uses it.

## Impact

- Frontend: `map/` (page, saved-farms and land-detail components replaced or reworked), `lands-api.service.ts` and `SavedFarm` (add `waterSource`), i18n keys for mr/hi/en, specs, Playwright golden path if it touches the saved-farms panel.
- Backend: none.
