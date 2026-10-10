## Context

Crop screens live in `features/crop-timeline/`: `CropDashboardComponent` (list), `CropActivityComponent` (detail with timeline and lifecycle stepper, delete FAB), `AddCropComponent` (form). `CropTimelineService` owns crops (signal) and exposes `updateCrop`, `deleteCrop`, `advanceStage`, `costForCrop` and the crop-scoped activities. Data mapping is in `crop-mapper.service.ts`. The backend crop already carries `irrigation_type` and `farming_method` (from `profile-settings`); `CropEntity` does not. The prototype (`crops()`, `cropdetail()`, `addcrop()`) uses four stages and a 4-tile detail.

## Goals / Non-Goals

**Goals:** match the prototype's three crop screens on desktop and phone; add edit; carry irrigation and farming method end to end.

**Non-Goals:** the sales card and harvest recording, activity types/statuses/form, backend changes, changing the eight stored stages.

## Decisions

1. **Rework the existing components in place.** Routes stay (`/crops`, `/crops/add`, `/crops/:cropId`); add `/crops/:cropId/edit` that reuses `AddCropComponent` in edit mode (it reads the crop by id, fills the form, and calls `updateCrop`). The old long timeline template is replaced by the new detail layout, keeping the `create` activity child route.
2. **Stage display only.** `crop-timeline.utils.ts` gets `stageStep(stage): 0..3` and `STAGE_STEPS` (labels as translation keys). A small presentational `StageBarComponent` takes `step` and renders four marks plus labels, with `role="img"` and an `aria-label` such as "Stage 3 of 4: Flowering". The stored stage stays one of the eight, so advancing and activity syncing do not change.
3. **Crop-type icon** from the catalog name with a small lookup (maize, cereal, fruit, vegetable fallback) like the prototype's `cropIcon`, as Bootstrap Icons classes.
4. **Detail tiles from existing data.** Age from `sowingDate`; Activities from `getActivitiesForCrop` (done = Completed, planned = not Completed and not Cancelled); Crop cost from `costForCrop`; Area from the crop's own area and unit. Chips filter the list; counts shown on each chip.
5. **Entity and mapping.** `CropEntity` gains `irrigationType?` and `farmingMethod?`; `CropMapperService` maps `irrigation_type` and `farming_method` both ways (empty becomes null). `NewCrop` and `updateCrop` pass them through.
6. **Form.** The existing reactive form gains `season`, `irrigationType`, `farmingMethod`. Season is required; the existing season derivation from the sowing date becomes the default value when the farmer has not chosen one. Option lists are constants stored by English value and shown through translation keys, like water source on lands.
7. **Layout with Bootstrap.** Cards in a two-column grid from `md` (one column on phones); detail tiles in a four-column row from `md`, two columns below; Activities and Timeline side by side from `lg`.
8. **Delete** keeps the shared confirm dialog and the existing toast; the list card menu is a Bootstrap dropdown driven by a signal, as in the Lands list.
9. **Translation.** New strings in mr, hi and en; the completeness check must stay green.

## Risks / Trade-offs

- Four displayed steps hide the finer eight; farmers can still see the exact stage in the detail header line (stage name from the stored value).
- Editing a crop's land would move its activities' context; the land stays read-only in edit mode (shown, not changeable) to avoid orphaning expenses.
- The old detail page had the delete button and "back to dashboard"; both move to the card menu and the back link, so no ability is lost.

## Migration Plan

Frontend only. Existing crops have irrigation and farming method copied from their farm by `profile-settings`, so they appear in the detail header immediately.

## Open Questions

- Sales: the prototype detail has a Sales card. Assumed left to `harvest-and-sale-tracking`; the detail layout leaves room for it between the tiles and the Activities card.
