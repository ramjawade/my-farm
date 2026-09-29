# Tasks

Each numbered group is one sub-issue / one PR, stacked on the parent branch (board-first parent-epic flow). Backend groups run `ruff`, `mypy`, `pytest` (and `python scripts/export_openapi.py` + `npm run generate:contracts` when a router/schema changes). Frontend groups update their specs and gate on `npm run build`; group 6 runs the full lint/test pass.

## 1. Backend: chat history (#286)

- [ ] 1.1 Add `ChatMessage` model (tenant scoped: `farmer_id`, `role`, `kind`, `text`, `created_at`) and Alembic migration `0005_chat_message`; verify `alembic upgrade head` applies and a test creates and reads a row
- [ ] 1.2 Add `assistant` router with `GET /messages?limit&before`, `POST /messages` (batch of 1–2, trims to 500 in the same transaction), `DELETE /messages`; register in `main.py`; verify with endpoint tests for order, paging, per-farmer isolation, the 501st-message trim and clear
- [ ] 1.3 Regenerate `openapi.json` and `npm run generate:contracts`; verify no drift and `ruff`, `mypy`, `pytest` pass

## 2. Backend: data queries (#287)

- [ ] 2.1 Add `core/assistant_queries.py` with one function per topic (`spend`, `spend_by_category`, `recent_activities`, `pending_activities`, `lands`, `crops`) returning plain fact dicts, all filtered by `farmer_id` and `deleted_at IS NULL`; verify tests for totals matching `/activities/summary` for the same scope and for a second farmer's data being excluded
- [ ] 2.2 Add name resolution for crop/land words against the farmer's own rows (exact/case-insensitive, reuse `entry_resolver` matching), returning matched / ambiguous / unknown; verify tests for all three outcomes
- [ ] 2.3 Add `weather` topic using the first land with points (centroid → existing `core/weather.get_weather`); verify tests with the weather call stubbed, including no-land and error cases

## 3. Backend: routing and answers (#288)

- [ ] 3.1 Add prompt builders and Pydantic schemas for the routing call (closed `topic` enum) and the answer call, in `core/assistant.py` / `schemas/assistant.py`; verify unit tests that the prompt lists only allowed topics and that the language is passed through
- [ ] 3.2 Add `POST /api/v1/assistant/ask`: classify → (log/unsupported return intent only) → resolve names → run topic query → compose answer; ambiguous/unknown names return `needs_clarification` with options; verify endpoint tests with the stub provider for log, unsupported, spend question, pending question, unknown crop and Marathi language
- [ ] 3.3 Validate numbers in the composed answer against the supplied facts, falling back to a templated sentence on mismatch; verify a test where the stub provider returns a wrong figure
- [ ] 3.4 Provider failure or invalid output returns 503; verify tests, and that logs contain intent/topic but not message text
- [ ] 3.5 Regenerate OpenAPI and contracts; verify no drift and `ruff`, `mypy`, `pytest` pass

## 4. Backend: daily brief (#289)

- [ ] 4.1 Add `GET /api/v1/assistant/brief` returning structured `weather?`, `pending {count,next[]}`, `spend_7d`, `has_data` with no LLM call; verify tests for a farmer with data, a new farmer (`has_data=false`), and weather failure (weather omitted, 200)
- [ ] 4.2 Regenerate OpenAPI and contracts; verify no drift and `ruff`, `mypy`, `pytest` pass

## 5. Frontend: routing, answers, language (#290)

- [ ] 5.1 Add `AssistantApiService` (`ask`, `brief`, `listMessages`, `appendMessages`, `clearMessages`) over the generated contracts, with a spec; verify `npm run build`
- [ ] 5.2 Update `ChatOrchestratorService.sendText`: when not clarifying, call `ask` with the current app language; `log` continues into the existing parse flow, `question` appends the answer (or clarification chips from `needs_clarification`), `unsupported` shows a localized help message; `ask` failure falls back to `parse`; update `chat-orchestrator.service.spec.ts`; verify build
- [ ] 5.3 Add en/hi/mr i18n keys for the help message (with example-question chips) and answer errors, and update the panel title/subtitle/placeholder to the mockup wording ("My farm assistant", drop "nothing is saved yet"); verify build and that the three locale files have the same keys

## 6. Frontend: history and brief (#291)

- [ ] 6.1 Persist turns via `appendMessages` after each farmer/bot exchange (failures swallowed); on open load the last 50 messages as plain text (no chips/review action) with "load older" paging; update specs; verify build
- [ ] 6.2 On open, fetch `brief` only when restored history has no `brief` message dated today, render it from i18n keys with params in en/hi/mr with example-question chips, and persist it with `kind="brief"`; verify build
- [ ] 6.3 Add a trash icon in the panel header for "Clear chat" with a confirmation dialog calling `clearMessages` and resetting the thread; verify build
- [ ] 6.4 Run `npm run lint`, `npm run build`, `npm test` and the Prettier check on `ts`/`html`/`scss`; grep `e2e/` for changed selectors/text (title, disclaimer, placeholder) and update them; verify all pass

## 7. Integration (parent PR)

- [ ] 7.1 Against the merged parent branch run backend `ruff`, `mypy`, `pytest` and frontend lint/build/test; verify all green in CI
- [ ] 7.2 Check every requirement in `specs/` exists in code (grep, not checkboxes), and record routing latency and extra LLM calls per fresh message on the deployed environment; verify findings noted on the parent issue
