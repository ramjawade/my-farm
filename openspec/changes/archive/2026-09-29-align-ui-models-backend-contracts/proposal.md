# Proposal

Belongs to parent epic #174 (sub-issue #270 is group 1).

## Why

Domain models store reference data as free-text names (`CropEntity.cropType`, `Activity.type`, `ActivityExpense.category`) while the backend stores FK ids. Every read and write therefore resolves name <-> id through `ReferenceDataService` inside async wire mappers (`CropMapperService`, `ActivityMapperService`). That forces `await` on every mapping, throws on unknown names, and couples the models to the seed list. Ids are what the backend already speaks; names are a display concern, and `ReferenceNamePipe` already renders them (with translation).

## What Changes

- `CropEntity`/`NewCrop`: `cropType: string` -> `cropCatalogId: number`.
- `Activity`: `type: ActivityType` -> `activityTypeId: number`.
- `ActivityExpense`: `category: ExpenseCategory` -> `expenseCategoryId: number`.
- Forms and dropdowns bind to ids; display names resolve at render time via `ReferenceNamePipe` / a synchronous cached lookup.
- Wire mappers stop calling `ReferenceDataService` and become synchronous.
- **BREAKING** (internal): every consumer of the three string fields changes, including the chat-bot review popup and reports.

## Capabilities

### New Capabilities
- `reference-data-ids`: domain models carry reference FK ids; names are resolved for display only; wire mapping is synchronous.

### Modified Capabilities
<!-- none: no specs exist yet -->

## Impact

- `core/api/activity-mapper.service.ts`, `features/crop-timeline/crop-mapper.service.ts`, `core/api/reference-data.service.ts` (mappers, lookups)
- Models: `crop-timeline.models.ts`, `activity.models.ts`, `activity.constants.ts`, `activity-display.ts`
- Consumers: crop-timeline (add-crop, dashboard, activity), farm-activity (create, list, dashboard, detail, add-expense, expense-list), home, reports, chat-bot (review popup, `chat-decision`, `chat-entry.service`)
- Specs: matching `*.spec.ts` files update in each PR
- No backend or API contract change.

## Non-goals

- No backend changes or new endpoints.
- `Season`, `CropStage` and language stay as they are (not id-backed here, see #190).
- No user-visible behaviour change: same labels, translations and persistence.
- The `SavedFarm.geoJson` read gap (#193) and mapper dedup (#194) are already done and not revisited.
