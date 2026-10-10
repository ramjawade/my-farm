# Tasks

## 1. Master logo and the small mark

- [x] 1.1 Add the original logo as `design/logo/myfarm-logo-master.webp` (1261 × 1247, transparent) and a short `design/logo/README.md` saying how to regenerate the assets
- [x] 1.2 Draw `public/brand/mark.svg` (64 × 64 viewBox: leaf-green ring, soil line, three-leaf sprout in the emblem's colours) and check it side by side with the emblem at 16, 24, 32 and 48 px

## 2. Asset build script and check

- [x] 2.1 Add `scripts/build-brand-assets.mjs` that trims the master's transparent margin, pads it to a square and uses Playwright's Chromium to write `public/brand/logo-{96,192,512}.webp`, `public/icons/icon-{72,96,128,144,152,192,384,512}.png`, `public/icons/maskable-{192,512}.png` (emblem at 72% on a solid light background), `public/apple-touch-icon.png` (180 px, opaque) and `public/favicon.svg`
- [x] 2.2 Write `public/favicon.ico` (16, 32 and 48 px PNG entries rasterised from the mark) from the same script
- [x] 2.3 Add `--check` mode: read `public/manifest.webmanifest`, fail on a missing icon file or a PNG whose pixel size differs from the stated `sizes`; also require the favicon files and the Apple touch icon
- [x] 2.4 Add `npm run brand:build` and `npm run brand:check`, chain `brand:check` into `npm run lint`, and run the build once to produce the assets

## 3. Wire the assets into the app

- [x] 3.1 Update `public/manifest.webmanifest`: new icon list with separate `any` and `maskable` entries, `theme_color` `#2f7a3f`, `background_color` `#eef1ec`
- [x] 3.2 Update `projects/home/src/index.html`: SVG favicon, `.ico` fallback and `apple-touch-icon` links
- [x] 3.3 Add `--mf-logo-backing` (white, same in both theme blocks) to `_tokens.scss`

## 4. The brand logo component and its uses

- [x] 4.1 Add `app-brand-logo` (`layout/brand-logo/`): inputs `size` and `decorative`; emblem with `NgOptimizedImage` on a round backing at 48 px and up, the mark below; reserved width and height; `alt=""` plus `aria-hidden` when decorative, `alt="MyFarm"` otherwise
- [x] 4.2 Use it in the header brand in `layout/toolbar/toolbar.html` (replacing the tree glyph, 32 px)
- [x] 4.3 Use it on the login card in `features/auth/login.component.html` and `.scss` (replacing the tile, 96 px); keep the card layout otherwise unchanged

## 5. Tests and checks

- [x] 5.1 Unit spec for `app-brand-logo`: emblem at 48 and above, mark below; decorative hides it from screen readers; non-decorative has the alt text; width and height are set
- [x] 5.2 Preview the maskable icons with a circle and a squircle mask and the favicon at 16, 32 and 48 px; look at them
- [x] 5.3 Headless check of the production build in both themes: header and login show the logo, no layout shift, the emblem stays visible on the dark theme, every manifest icon and the favicon respond with 200, no overflow at 375 px; look at the screenshots
- [x] 5.4 Run `npm run lint` (includes `lint:colors` and `brand:check`), `npm run format:check`, `npm run build` and `npm test` (home and shared); CI runs the Playwright golden path

## 6. Wrap-up

- [x] 6.1 After the PR merges, archive this change and tick task 1.3 in `prototype-adoption-roadmap/tasks.md`
