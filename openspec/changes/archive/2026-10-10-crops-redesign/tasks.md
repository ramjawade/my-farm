## 1. Data and helpers

- [x] 1.1 Add `irrigationType` and `farmingMethod` to `CropEntity`; map `irrigation_type` and `farming_method` both ways in `CropMapperService`; unit specs
- [x] 1.2 Add `stageStep` and `STAGE_STEPS` to `crop-timeline.utils.ts` with specs for all eight stages
- [x] 1.3 Add `StageBarComponent` (four steps, labels, accessible name) with specs
- [x] 1.4 Move the old eight-step crop lifecycle stepper out of the crop detail into the shared library as `LifecycleStepperComponent` (inputs: steps, current index, label), with specs, for later use; the new screens do not use it

## 2. Crops list

- [x] 2.1 Restyle `CropDashboardComponent` cards: icon, name, plot, age, area, stage bar, activity-count badge, actions menu (Edit, Delete with confirmation); keep search; empty state with Add crop
- [x] 2.2 Specs: card content, open detail, search, delete confirmation, empty state

## 3. Crop detail

- [x] 3.1 Rebuild `CropActivityComponent` layout: back link, header line (land link, stage, irrigation, method), Log activity, Stage card with advance action, four tiles
- [x] 3.2 Activities card with All / Upcoming / Recent chips and counts, and the Timeline card
- [x] 3.3 Specs: tiles, optional header parts, chip filtering, advance stage

## 4. Add and edit

- [x] 4.1 Restyle the form and add Season, Irrigation type and Farming method; Season defaults from the sowing date
- [x] 4.2 Add `/crops/:cropId/edit` reusing the form: prefill, save via `updateCrop`, land read-only
- [x] 4.3 Specs: create with and without optional fields, required errors, edit saves, no-lands state

## 5. Strings and wrap up

- [x] 5.1 mr, hi and en strings; keep the translation check green
- [x] 5.2 Update the Playwright golden path if it uses the old add-crop form or detail page
- [x] 5.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [x] 5.4 Open the PR naming `crops-redesign`
- [x] 5.5 After the PR merges, archive this change and tick task 3.3 in `prototype-adoption-roadmap/tasks.md`
