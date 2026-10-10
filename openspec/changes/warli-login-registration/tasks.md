# Tasks

## 1. Tokens and assets

- [ ] 1.1 Add the Warli mud and rice colour tokens for light and dark in the token layer (colour lint stays clean)
- [ ] 1.2 Add `WarliSceneComponent` with the prototype's village SVG (themed through `currentColor`, `aria-hidden`)

## 2. Number pad and steps

- [ ] 2.1 Add `NumberPadComponent` (12 keys, Devanagari sub-labels for mr/hi, busy state, accessible names, `data-testid` per key)
- [ ] 2.2 Rework `LoginComponent` into the six-step flow (`phone`, `pin`, `name`, `create`, `confirm`, `done`) reusing `SessionAuthService`; digit-only input, 10-digit number, 4-digit new PIN, 4 to 6 digit sign-in PIN
- [ ] 2.3 Phone slots, PIN boxes with show-then-mask and Show/Hide PIN, progress dots, "Change" link
- [ ] 2.4 Keyboard support (digits, Backspace, Enter) and focus to the name field on the name step
- [ ] 2.5 Inline errors in alert banners with one shake; clear on next key; wrong PIN clears the PIN; mismatch returns to "Choose a new PIN"; taken number returns to the PIN step; unreachable never registers
- [ ] 2.6 Welcome screen with first name, then navigate to `/map` after 1.6 s; keep the redirect for signed-in visitors
- [ ] 2.7 Hero layout: wide screen (chips + language switch above card) and phone band; remove the house button and background blobs; reduced-motion handling

## 3. Text

- [ ] 3.1 Replace and extend `login.*` keys in `mr.json`, `hi.json` and `en.json` with the prototype wording; remove unused old keys
- [ ] 3.2 Run `npm run i18n:check` and fix any parity or raw-text findings

## 4. Tests

- [ ] 4.1 Unit specs for the step flow: existing farmer, new farmer, wrong PIN, locked, unreachable, taken number, mismatch, 6-digit PIN
- [ ] 4.2 Unit specs for the number pad and keyboard handling
- [ ] 4.3 Update `e2e/golden-path.spec.ts` and `e2e/profile-persistence.spec.ts` to sign in and register through the pad

## 5. Wrap up

- [ ] 5.1 Run `npm run lint` and `npm run build`; fix findings
- [ ] 5.2 Headless check of the login screen in mr, hi and en at 1280 px and 375 px, light and dark: no overflow, pad visible without scrolling on a phone
- [ ] 5.3 Open the PR naming `warli-login-registration`
- [ ] 5.4 After the PR merges, archive this change and tick task 2.1 in `prototype-adoption-roadmap/tasks.md`
