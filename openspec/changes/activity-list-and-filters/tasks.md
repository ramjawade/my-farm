## 1. Numbers

- [ ] 1.1 Add `activity-log-summary.ts` with `logTiles` and `seasonByCategory`, with specs on fixed dates

## 2. Components

- [ ] 2.1 `ActivityRowComponent`: date chip, name (struck through when Cancelled), sub line, badge or amount, chevron, with specs
- [ ] 2.2 `ActivityFilterBarComponent`: Filters toggle with count badge, chips in the same row while closed, Showing N of M, Clear, panel of six selects, with specs
- [ ] 2.3 Season expenses card (total and bars by category, empty text) with specs

## 3. Screen

- [ ] 3.1 Rework the list page header, tiles and layout (phone order, two columns from lg, spacing as on Home)
- [ ] 3.2 Use the new rows, empty state and no-match state; keep Load more, URL sync and the crop-scoped route working
- [ ] 3.3 Remove the grid/list toggle, the old cards and the per-card delete from the list page
- [ ] 3.4 Update `activity-list.component.spec.ts`

## 4. Strings and wrap up

- [ ] 4.1 mr, hi and en strings; keep the translation check green
- [ ] 4.2 Update the Playwright golden path if it reads the list
- [ ] 4.3 Run `npm run lint`, `npm run build` and `npm test`; fix findings
- [ ] 4.4 Open the PR naming `activity-list-and-filters`
- [ ] 4.5 After the PR merges, archive this change and tick task 3.5 in `prototype-adoption-roadmap/tasks.md`
