# Tasks

## 1. Shared chat scope
- [ ] 1.1 Add `ChatUiStateService` (overlayOpen, reviewOpen signals + methods)
- [ ] 1.2 Add `ChatScopeDirective` providing `ChatOrchestratorService` + `ChatUiStateService`; apply it on `.app-layout` in `app-layout.html`
- [ ] 1.3 Remove `providers` from `ChatBotContainerComponent`; switch its `open`/`reviewOpen` to the shared service; update specs

## 2. Chat page and navigation
- [ ] 2.1 `ChatPanelComponent`: `mode` input (`overlay` | `page`), `expand` output, expand button in overlay mode, hide close in page mode; specs
- [ ] 2.2 `ChatPageComponent` under `features/chat-bot/chat-page/` (full height, calls `onOpen()`, review via shared state); spec
- [ ] 2.3 `/chat` route with `authGuard` in `app.routes.ts`
- [ ] 2.4 Sidebar "Chat" link (`bi-chat-dots`) + `sidebar.chat`, `chatBot.expand` i18n keys in en/hi/mr
- [ ] 2.5 Container: hide FAB and close overlay on `/chat`; expand → close overlay + navigate `/chat`; specs

## 3. Gates
- [ ] 3.1 grep `e2e/` for chat selectors and update if changed
- [ ] 3.2 `npm run lint`, `npm run build`, `npm test`, Prettier check
