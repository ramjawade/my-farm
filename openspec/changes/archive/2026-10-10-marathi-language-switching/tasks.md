# Tasks

## 1. Language selection and the Marathi default

- [x] 1.1 Extend `LanguageService`: active language = signed-in farmer's `preferredLanguage`, else the device language (`my_farm_language`, read in a `try/catch`), else `mr`; unsupported stored values fall back to `mr`; add `setDeviceLanguage()`; set `document.documentElement.lang` in the same effect that calls `translate.use`
- [x] 1.2 Make a language change in Profile (and the profile edit dialog) also write the device language; remove the toolbar-era dropdown code paths that are left over
- [x] 1.3 Registration: send the active language as `preferred_language` and fall back to `mr` (not `en`) when a profile has none, in `session-auth.service.ts`
- [x] 1.4 Start `index.html` with `lang="mr"`; add `my_farm_language` to the kept keys in `legacy-storage-cleanup.ts` with a spec
- [x] 1.5 Add `app-language-switch` (`layout/language-switch/`): a `.seg` control with मराठी / हिंदी / English, `aria-pressed`, each labelled in its own language; place it on the login card

## 2. Dates, numbers and money

- [x] 2.1 Register `mr`, `hi` and `en-IN` locale data and add a `LocaleService` that follows the active language
- [x] 2.2 Add `LocalizedDatePipe` and `LocalizedNumberPipe` that read the active language (output changes live, no reload) and switch the existing `| date` and `| number` uses (about 20 places) to them with the same format strings
- [x] 2.3 Specs: Marathi month names, Indian grouping (₹1,24,500) in all three languages, Western digits locked in, English dates unchanged, live switch changes the output

## 3. Translate everything

- [x] 3.1 Write a small audit (reused by the check script) that lists raw text nodes and `placeholder`, `title`, `aria-label` and `alt` attributes in templates and inline templates, and find the strings written in TypeScript (toasts, labels, chart text, error mapping)
- [x] 3.2 Move the hard-coded text of `login`, `home` and `not-found` into the three translation files and use keys
- [x] 3.3 Move the hard-coded text of `profile-edit-dialog` and `reports` into the translation files and use keys
- [x] 3.4 Move the hard-coded text of `weather` (including `history-trend`, `sun-path`, advisories and alerts) and the remaining files into the translation files; rebuild the weather chart labels when the language changes
- [x] 3.5 Translate the strings written in TypeScript (toasts, confirmations, validation and API error messages) with `translate.instant`
- [x] 3.6 Align the Marathi and Hindi wording with the prototype glossary for every term where the two differ (the 17 found so far and any others), and list each changed or new term in the PR description
- [x] 3.7 Check the reference names (`crop.*`, `activity.*`, `expense.*`, `stage.*`, `season.*`, `status.*`) cover every seeded name in Marathi and Hindi, and fill gaps

## 4. Translation check

- [x] 4.1 Add `scripts/check-translations.mjs`: fail on a key missing in any language, an empty value, a differing set of `{{placeholders}}`, or raw text in a template; add `npm run i18n:check` and chain it into `npm run lint`; self-test it on small samples
- [x] 4.2 Update `e2e/golden-path.spec.ts` and `e2e/profile-persistence.spec.ts` to set `my_farm_language` to `en` before each test so labels and registration behave as today

## 5. Tests and checks

- [x] 5.1 Unit specs: `LanguageService` (precedence, default Marathi, bad stored value, `lang` attribute, device write on change), `app-language-switch`, the registration language, the check script
- [x] 5.2 Headless check of the production build in Marathi, Hindi and English at 1280 px and 375 px on login, Home, Lands, Crops, Activity, Reports, Weather and Profile: no English left in Marathi or Hindi, no overflow or clipped labels (look at the phone tab bar and buttons), dates and amounts formatted correctly, `lang` attribute right, switching works before and after sign-in and survives reload; look at the screenshots
- [x] 5.3 Run `npm run lint` (includes the colour, brand and translation checks), `npm run format:check`, `npm run build` and `npm test` (home and shared); CI runs the Playwright golden path

## 6. Wrap-up

- [x] 6.1 After the PR merges, archive this change and tick task 1.5 in `prototype-adoption-roadmap/tasks.md`
