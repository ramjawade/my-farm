## 1. Foundations + crop ids (sub-issue #270)

- [x] 1.1 Add sync accessors `cropName(id)`, `activityTypeName(id)`, `expenseCategoryName(id)` and a shared `ready` promise to `ReferenceDataService`; verify with a spec for hit, miss and pre-load cases.
- [x] 1.2 Start the preload right after the session is issued without awaiting it in login; verify sign-in does not wait (spec) and that no extra requests are made versus today.
- [x] 1.3 Keep create-or-get writes updating the cache and make unknown ids resolve to an empty string; verify with specs for farmer-created entries and unknown ids.
- [x] 1.4 Replace `cropType` with `cropCatalogId: number` in `CropEntity`/`NewCrop`; `CropMapperService` maps `crop_catalog_id` directly with no lookup; verify with `crop-mapper.service.spec.ts`.
- [x] 1.5 Bind the add-crop form to the catalog id, creating a catalog entry via `createCrop` for farmer-typed names; render crop names with `referenceName` where shown. Verify with updated `add-crop`, `crop-dashboard`, `crop-activity`, `reports` and `home` specs and `npm run build`.

## 2. Expense category ids

- [x] 2.1 Replace `ActivityExpense.category` with `expenseCategoryId: number`; `expenseFromBackend`/`expenseToBackend` map it directly; verify with `activity-mapper.service.spec.ts`.
- [x] 2.2 Migrate `add-expense`, `expense-list`, `activity.service`, `crop-timeline.service`, `report.service`, `reports.component` to ids: group by id, sort by resolved name, labels via pipe or accessor; verify report specs still produce the same groups and `npm run build`.
- [x] 2.3 Convert to ids at the chat-bot boundary: the popup and `chat-decision` keep working in category names, `chat-entry.service` resolves the name to an id when creating; verify with `chat-entry.service.spec.ts`.

## 3. Activity type ids

- [x] 3.1 Replace `Activity.type` with `activityTypeId: number`; add `ReferenceDataService.isActivityType(id, name)` and route every `'Custom'`/`'Harvest'`/`'Sowing'` branch through it; verify with `reference-data.service.spec.ts`.
- [x] 3.2 Migrate `create-activity`, `activity-list`, `activity-dashboard`, `activity-detail`, `home`, `activity-display` and `crop-timeline.service` to ids with render-time names; verify with their specs and `npm run build`.
- [x] 3.3 Convert to ids at the chat-bot boundary: the popup and `chat-decision` keep working in type names, `chat-entry.service` resolves the name to an id when creating; verify with `chat-entry.service.spec.ts`.

## 4. Retire async lookups in mappers

- [ ] 4.1 Make `ActivityMapperService` and `CropMapperService` synchronous with no `ReferenceDataService` dependency; remove the now-unused name<->id methods from `ReferenceDataService`; verify with `grep` (no remaining `NameForId`/`IdForName` callers) and `npm run build`.
- [ ] 4.2 Full gates against the parent branch: `npm run lint`, `npm test`, `npm run build`, and the e2e golden path; verify all pass with no label or report regressions.
- [ ] 4.3 Sync delta specs to `openspec/specs/` and archive the change (`/opsx:archive`) after the parent PR merges.
