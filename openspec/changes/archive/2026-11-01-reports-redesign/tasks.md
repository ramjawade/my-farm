# Tasks

One PR on `claude/feature-reports-redesign`. Frontend only. UX source: `design/prototype/myfarm-prototype.html`, screen `reports` (approved and committed on this branch). Load the `angular-best-practices` skill before writing components.

## 1. Report model and service

- [x] 1.1 Extend `ReportService.generateSeasonReport` with `totalSales`, `cropsSold`, `cropCount` and `crops: CropProfit[]` (sales from Completed Sale activities in the selection, expenses per crop, profit per acre via `summarizeSales`); remove the expense-only `byCrop`. Verify: service specs for a mixed season (completed and planned sales, a crop with no sale, a crop with no area, expenses on an activity with no crop).
- [x] 1.2 Add `compareRows(cropName)` for Compare seasons (one row per crop of that name from season and sowing year, area, completed sales, expenses, profit per acre, In progress for Active crops, unaffected by the filter). Verify: specs for two sowings ordered newest first and a crop with no sales.
- [x] 1.3 Extend the CSV (summary, profit by crop, category, month) and hide export when there is no data. Verify: spec on the generated CSV text including quoting of a crop name with a comma.

## 2. Reports page

- [x] 2.1 Rebuild `ReportsComponent` with Season and Year chips, a computed live report, no Generate button, and the "report" workflow phase marked once on first render with data. Verify: component spec that changing a chip updates the sections and that the phase is marked once.
- [x] 2.2 Add small presentation components for the filter chips, season summary (Net so far colour, Crops sold "N of M", hint), profit-by-crop rows (open crop on select) and the category and month bars, using Bootstrap utilities. Verify: specs for the summary figures, the colours, "No sales yet", "–" without area, and navigation on a crop row.
- [x] 2.3 Add the Compare seasons card (crop-name chips, rows with bars, In progress badge, "Not filtered" label) and the empty state with the chips and Compare seasons kept. Verify: specs for choosing a crop name, filter independence, and the empty message.
- [x] 2.4 Place Export CSV top right on wide screens and at the bottom on phones; add en, hi and mr strings for every new label, remove the unused `reports.*` keys. Verify: `npm run lint` (translation check) passes and the component spec finds the button in both placements.

## 3. Roadmap, PR and archive

- [x] 3.1 Update the Playwright golden path if it opens Reports; run `npm run lint`, `npm run build` and `npm test`. Verify: all green locally.
- [x] 3.2 Open the draft PR (it holds the prototype and plan). Verify: PR links this change and CI runs.
- [x] 3.3 Once CI is green, archive the change on this branch (sync the new `reports` spec, tick roadmap 4.6) and mark the PR ready. Verify: `openspec/specs/reports/spec.md` exists and the change sits under `archive/`.
