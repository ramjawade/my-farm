## 1. Data

- [x] 1.1 Add `waterSource` to `SavedFarm` and map `water_source` in `LandsApiService` (read, create, update); unit specs
- [x] 1.2 Crop names and costs are present on first paint: crops and activities already load at sign-in (`CropTimelineService`), the page keeps loading lands as before

## 2. Page and list

- [x] 2.1 Rework `map.html` into the header, map card and "All lands" layout (two columns from `lg`, one below); `invalidateSize()` after layout changes
- [x] 2.2 Add `LandOutlineComponent` (inline SVG polygon) with a placeholder for lands without points
- [x] 2.3 Add `LandsListComponent` replacing `saved-farms`: cards with outline, name, crop names or Fallow badge, area, selection, actions menu (Rename, Delete with confirmation)
- [x] 2.4 Inline rename with empty-name error

## 3. Detail and drawing

- [x] 3.1 Rewrite `LandDetailComponent`: "Nothing growing" empty state with Add crop; KPIs (Area, Crops, Total expenses, Cost per acre, Water source), crop link, "+ Add another crop"; keep a notes edit action
- [x] 3.2 Restyle the drawing flow: step badges, Save land form with name, read-only area, optional Water source and notes, Discard, and the saved card (Add crop, Not now)
- [x] 3.3 "No lands yet" empty state with Draw your first land
- [x] 3.4 Add crop buttons go to `/crops/add?landId=<id>`; `AddCropComponent` preselects that land

## 4. Strings and tests

- [x] 4.1 mr, hi and en strings (including Farm Pond); keep the translation check green
- [x] 4.2 Unit specs: header totals, card with crops and Fallow, selection, rename and empty name, delete confirmation, detail empty and growing states, save form with water source, name required, discard
- [x] 4.3 Update the Playwright golden path if it uses the old saved-farms panel

## 5. Wrap up

- [x] 5.1 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [x] 5.2 Open the PR naming `lands-redesign`
- [x] 5.3 After the PR merges, archive this change and tick task 3.2 in `prototype-adoption-roadmap/tasks.md`
