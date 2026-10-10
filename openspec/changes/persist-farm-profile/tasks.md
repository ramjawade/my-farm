## 1. API (sub-issue A)

- [x] 1.1 Add `setup_completed` and `crop_catalog_ids` to farm update; return `crop_catalog_ids` on farm read. Verify: pytest for replace, dedupe, unknown id 422, omitted unchanged.
- [x] 1.2 Add validated `user_role` to profile update. Verify: pytest valid/invalid role round-trips via `GET /me`.
- [x] 1.3 Default farm = lowest id is resolved client-side (task 2.1); the list order stays unchanged so other callers are unaffected.
- [x] 1.4 Export OpenAPI and regenerate client contracts. Verify: `python scripts/export_openapi.py`, `npm run generate:contracts` show no stray diff.
- [x] 1.5 `ruff`, `mypy`, `pytest` pass.

## 2. Client (sub-issue B)

- [x] 2.1 Shared default-farm resolver (lowest id, create if missing) used by profile and Lands. Verify: unit spec.
- [x] 2.2 Async `updateProfile` writing `/me` and farm; state updated only on success. Verify: unit specs incl. failure and no-farm paths.
- [x] 2.3 Hydrate farm fields after login and session restore. Verify: unit spec.
- [x] 2.4 Dialog: saving state, error handling, phone read-only, remove "Other" crop. Verify: component spec.
- [x] 2.5 Golden-path e2e: save, reload, values persist.
- [x] 2.6 `npm run lint` and `npm run build` pass.
