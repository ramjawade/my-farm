## 1. API (sub-issue A)

- [ ] 1.1 Add `setup_completed` and `crop_catalog_ids` to farm update; return `crop_catalog_ids` on farm read. Verify: pytest for replace, dedupe, unknown id 422, omitted unchanged.
- [ ] 1.2 Add validated `user_role` to profile update. Verify: pytest valid/invalid role round-trips via `GET /me`.
- [ ] 1.3 Default-farm ordering by lowest id wherever the API exposes it for resolvers. Verify: pytest.
- [ ] 1.4 Export OpenAPI and regenerate client contracts. Verify: `python scripts/export_openapi.py`, `npm run generate:contracts` show no stray diff.
- [ ] 1.5 `ruff`, `mypy`, `pytest` pass.

## 2. Client (sub-issue B)

- [ ] 2.1 Shared default-farm resolver (lowest id, create if missing) used by profile and Lands. Verify: unit spec.
- [ ] 2.2 Async `updateProfile` writing `/me` and farm; state updated only on success. Verify: unit specs incl. failure and no-farm paths.
- [ ] 2.3 Hydrate farm fields after login and session restore. Verify: unit spec.
- [ ] 2.4 Dialog: saving state, error handling, phone read-only, remove "Other" crop. Verify: component spec.
- [ ] 2.5 Golden-path e2e: save, reload, values persist.
- [ ] 2.6 `npm run lint` and `npm run build` pass.
