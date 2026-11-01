# Tasks

One PR on `claude/feature-assistant-sale-entry`. Backend checks: `ruff`, `mypy`, `pytest`; after any schema change run `python -m scripts.export_openapi` (from `projects/backend/`, so the worktree's code is used) then `npm run generate:contracts`. UX source: `design/prototype/myfarm-prototype.html`, screen `chat` (approved and committed on this branch). Load the `angular-best-practices` skill before frontend code.

## 1. Backend: parse and resolve sale figures

- [ ] 1.1 Add `sale_quantity`, `sale_unit`, `sale_rate`, `sale_amount` and `sale_buyer` (optional, default null) to `ParsedEntry` and `ResolvedEntry`. Verify: schema tests accept a response with and without them.
- [ ] 1.2 Extend the extraction prompt with the five fields and the rules (only said numbers, per-unit price vs total, never multiply, buyer only when named, null for non-sales). Verify: prompt tests assert the fields and each rule appear and that the farmer's text stays quoted.
- [ ] 1.3 In `resolve_entry`, pass the figures through, turn non-positive numbers and blank strings into null, and clear every sale field when the resolved type is not Sale; no `dropped` entry for missing figures. Verify: pure resolver tests for rate, total, zero and negative values, blank unit, and a non-Sale type carrying figures.
- [ ] 1.4 Regenerate `openapi.json` and the frontend contracts. Verify: the "contracts up to date" CI check passes; `ruff`, `mypy`, `pytest` are green.

## 2. Frontend: asking for what is missing

- [ ] 2.1 Add the sale fields to the client `ResolvedEntry` and a pure helper that fills the amount from quantity × rate or the rate from amount ÷ quantity. Verify: helper specs for each case and for values that are not numbers.
- [ ] 2.2 Add `saleQuantity` and `saleRate` to `chat-decision`: a Sale without a crop asks the crop (even when nothing was dropped), then quantity and unit, then rate or total, then date; land is skipped for Sale; other types are untouched. Verify: `chat-decision` specs for every order and "missing" case, and that a non-Sale entry never asks a sale question.
- [ ] 2.3 In the orchestrator, append typed answers to the sale questions with `correctionSentence`, keep the two-round limit, and keep using the existing escape navigation. Verify: orchestrator specs for typing an answer, a crop chip, and the third ask opening `/activities/create` with `type=Sale` and the crop.
- [ ] 2.4 Add the question texts for en, hi and mr. Verify: `npm run lint` (translation check) passes.

## 3. Frontend: Review & Save and saving

- [ ] 3.1 Show the Sale details block in `ReviewPopupComponent` for the Sale type: prefill from the parse, amount follows quantity × rate until overridden, crop required, date not after today, the activity form's error messages, and the block hidden with figures dropped when the type changes. Verify: component specs for prefill, a stated total, each error, the future date, and switching type.
- [ ] 3.2 Make `ChatEntryService.create` send the `sale` figures for a Sale and record the parsed figures in the provenance. Verify: service specs that a Sale saves as Completed with its figures, other types send none, and provenance holds the proposed values.
- [ ] 3.3 Confirm the saved sale shows on the crop's Sales card and Activity log (no new code expected). Verify: a spec or manual check noted in the PR using the existing selectors.

## 4. Roadmap, PR and archive

- [ ] 4.1 Add `assistant-sale-entry` to `openspec/changes/prototype-adoption-roadmap/tasks.md` after 4.4. Verify: the line is present.
- [ ] 4.2 Update the Playwright golden path only if it uses the assistant; run `npm run lint`, `npm run build`, `npm test` and the backend `ruff`, `mypy`, `pytest`. Verify: all green.
- [ ] 4.3 Open the draft PR (it holds the prototype and plan). Verify: the PR links this change and CI runs.
- [ ] 4.4 Once CI is green, archive the change on this branch (sync the new `assistant-sale-entry` spec, tick the roadmap) and mark the PR ready. Verify: `openspec/specs/assistant-sale-entry/spec.md` exists and the change sits under `archive/`.
