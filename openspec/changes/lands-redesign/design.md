## Context

`/map` renders `MapComponent` (Leaflet) with three overlays: `app-saved-farms` (collapsible list with rename, delete, notes), `app-map-search`, and `app-map-my-farm` (the drawing controls and save form). `land-detail` shows a selected land's crops and notes. The prototype's `lands()` instead lays out a map card with the selected land's detail, an "All lands" list, and a two-step save form. The backend already stores `land.water_source` (change `profile-settings`).

Existing data: `SavedFarm` (id, name, points, area, notes), `LandsApiService`, `CropTimelineService.cropsForField(landId)` and `costForCrop(cropId)` for crops and expenses.

## Goals / Non-Goals

**Goals:** match the prototype Lands screen on desktop and phone; show crop names, Fallow and expenses per land; let the farmer set water source when saving.

**Non-Goals:** changing Leaflet, the drawing mechanics or place search; the Crops screens; backend changes.

## Decisions

1. **Rework in place, don't rebuild the map.** `MapComponent` keeps owning the Leaflet map and the page's data lifecycle. The overlay panels become normal page sections: `LandsListComponent` (All lands, replaces `saved-farms`) and `LandDetailComponent` (rewritten) are presentation-only with `input()`/`output()`. Drawing controls stay in `app-map-my-farm`, restyled with the step badges and the new form fields.
2. **Layout with Bootstrap.** A two-column grid from `lg` up (map card left, list right), one column below. The map card has a fixed aspect ratio so Leaflet gets a real height; call `invalidateSize()` after the layout change.
3. **Land outline.** A small `LandOutlineComponent` draws the polygon as an inline SVG path, scaled to its bounding box, with `aria-hidden` and the land's colour from tokens. Lands without points show a plain placeholder.
4. **Crops, Fallow and costs from existing signals.** The list and detail read `CropTimelineService.cropsForField` for crop names, and sum `costForCrop` for the land's expenses. Cost per acre is expenses divided by the land's acres (zero area shows a dash). Crops and activities already load when the farmer signs in, so the list is not empty on first paint.
5. **Water source options** are a constant list `[Borewell, Canal, River, Farm Pond, Rainfed]` stored by English value (as the backend stores a free string), and translated for display through the existing `profileEdit.options.*` keys where they exist, with new keys for "Farm Pond".
6. **Mapping.** `SavedFarm` gains `waterSource?: string`; `LandsApiService` maps `water_source` both ways (create and update).
7. **Add crop link.** The Add crop buttons navigate to `/crops/add?landId=<id>`. `AddCropComponent` already exists; it preselects the land from that query parameter (small addition), and is restyled in `crops-redesign`.
8. **Selection and rename** reuse the current `selected` signal and rename logic; the menu uses Bootstrap's dropdown. Delete keeps the shared confirm dialog.
9. **Translation.** All new strings in mr, hi and en; the completeness check must stay green.

## Risks / Trade-offs

- Leaflet inside a card can render grey tiles if sized before layout → `invalidateSize()` on init and when the layout breakpoint changes.
- Cost per acre depends on the activities already loaded; if activities fail to load, the detail shows crops and area only, not a wrong zero.
- Notes were editable inline in the old panel; here notes are set when saving and edited through a Rename-style action later if needed. This change keeps a small edit-notes action in the detail so no ability is lost.

## Migration Plan

Frontend only. No data changes; existing lands have `water_source` copied from their farm by `profile-settings`.

## Open Questions

- The prototype's land colour dot is per-land; the app has no land colour. Assumed: a stable colour from the token palette chosen by land id.
