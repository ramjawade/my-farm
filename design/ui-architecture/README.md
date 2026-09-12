# UI Architecture Review

Structural audit of `projects/home/src/app`, checked against this repo's own
[`angular-best-practices`](../../.claude/skills/angular-best-practices/SKILL.md)
rules. Companion diagrams: [`ui-architecture-canvas.html`](./ui-architecture-canvas.html).

Nothing in `projects/home` has changed. This is the plan to react to before
any issue is opened on the board.

## Current structure

```
app/
├── core/                          consistent — one folder per domain, services only
├── features/                      feature-based, routed
│  ├── weather/weather.component.ts
│  ├── crop-timeline/crop-timeline.component.ts
│  ├── farm-activity/farm-activity.component.ts
│  ├── reports/
│  │  └── reports.component.ts    201-line inline template
│  └── shared/components/…
├── layout/                         bare filenames (not *.component.ts)
│  ├── toolbar/toolbar.ts
│  ├── sidebar/sidebar.ts
│  ├── footer/footer.ts
│  └── main/main.ts
├── map/                            outside features/
│  ├── map.ts                       bare filename, 318 lines
│  ├── component/map-my-farm/…      extra "component" layer features/ doesn't use
│  ├── controls/  farm-draw/
│  └── models/
└── app.routes.ts
```

## Findings

| Severity | Where | Issue |
|---|---|---|
| Structural | `map/` (whole folder) | Sits outside `features/` — the one routed feature not following the convention every other page uses |
| Structural | `toolbar.ts`, `sidebar.ts`, `footer.ts`, `main.ts`, `app-layout.ts`, `map.ts` (6 files) | Drop the `.component` suffix that every file under `features/` uses |
| Pattern | `weather.component.ts`, `toolbar.ts`, `app-layout.ts` (3 files) | Use `@HostListener`/`@HostBinding` decorators instead of the `host` object the repo's rules require |
| Cleanup | 16 files | Import the whole `CommonModule` instead of the specific pipes/directives used |
| Cleanup | 5 files | Still use `*ngIf`/`*ngFor` instead of native `@if`/`@for` |
| Cleanup | `reports.component.ts` | Bundles nearly every pattern above into one 201-line file: inline template, `CommonModule`, `FormsModule` + `ngModel`, `*ngFor` |

**Data loading (`ngOnInit` vs. resolvers) is not a finding.** `ngOnInit` stays
the default way a component loads its own data — simpler, and the component
controls its own loading/empty state. A route resolver is the exception,
reached for only where a route genuinely cannot proceed without the data
first (a guard depends on it, a parent shares it with children, or an
invalid `:id` should redirect before the component renders). See phase 3.

## Target structure

Same four top-level folders. `map/` moves in, naming converges on one
convention. `core/` and `shared/` don't change — they already model this
correctly.

```
app/
├── core/                                    unchanged
├── features/
│  ├── weather/weather.component.ts
│  ├── crop-timeline/…
│  ├── farm-activity/…
│  ├── reports/
│  │  ├── reports.component.ts               slimmed, reactive form
│  │  ├── reports.component.html
│  │  └── reports.component.scss
│  └── map/                                   moved from top level
│     ├── map.component.ts                   renamed
│     ├── components/map-my-farm/…           "component" → "components", matches shared/
│     ├── controls/  farm-draw/  models/
├── layout/
│  ├── toolbar/toolbar.component.ts          renamed
│  ├── sidebar/sidebar.component.ts
│  ├── footer/footer.component.ts
│  └── main/main.component.ts
└── app.routes.ts                            unchanged — resolvers stay opt-in
```

## Migration plan

Matches this repo's parent-issue-plus-sub-issue workflow: one parent epic,
one sub-issue and PR per phase. Each phase is independently mergeable.

1. **Naming & folder normalization** — risk: none (file moves + import path
   updates only). Rename the 6 bare files to `*.component.ts`; move `map/`
   under `features/map/`; rename its `component/` subfolder to `components/`.
2. **Template & decorator modernization** — risk: low, mechanical. Convert
   the 5 remaining `*ngIf`/`*ngFor` templates to `@if`/`@for`; drop
   `CommonModule` everywhere it's no longer needed; move the 3
   `@HostListener`/`@HostBinding` usages into each component's `host` object.
3. **Resolver audit** — risk: none if it finds no cases; can close as
   "no change needed". Walk the `:id` routes (`crop-timeline/:id`,
   `activities/:id`) for the one case worth a resolver — redirecting before
   render on an invalid id. Everything else keeps its `ngOnInit` fetch.
4. **`reports.component.ts` split-out** — risk: low, isolated to one feature.
   Extract the inline template and styles; replace `FormsModule` + `ngModel`
   with a reactive form. Data loading is untouched.

## Rules this plan is checked against

- `ngOnInit` by default — a resolver is the exception, not the default
  loading path.
- No `CommonModule` — import only the pipes/directives a template uses.
- Native control flow — `@if`/`@for`/`@switch`, not structural directives.
- `host` object over decorators — no `@HostListener`/`@HostBinding`.
- Feature-based top level — already correct in `core/` and `shared/`.
- Standalone, signals, `input()`/`output()` — already the convention
  everywhere audited; no violations found.

## Next step

Once this plan looks right, open the parent issue + one sub-issue per phase
on the board (Todo), per the `board-first` workflow. No code before approval.
