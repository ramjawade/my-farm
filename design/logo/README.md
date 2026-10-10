# MyFarm logo

- `myfarm-logo-master.webp` — the approved logo (1261 × 1247, transparent). This is the single source for every raster size.
- `../../projects/home/public/brand/mark.svg` — the hand-drawn simplified sprout mark, used below 48 px and for the favicon.
- `logo-concepts.html`, `leaf-concept.html` — earlier explorations, kept for reference.

## Regenerating the app assets

```bash
npm run brand:build   # writes public/brand/logo-*.webp, public/icons/*, public/favicon.*, public/apple-touch-icon.png
npm run brand:check   # fails if a manifest icon is missing or the wrong size (also runs in npm run lint)
```

To change the logo, replace the master (or edit `mark.svg`) and run `npm run brand:build`.
