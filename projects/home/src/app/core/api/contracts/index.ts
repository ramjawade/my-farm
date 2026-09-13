/**
 * MyFarm API contracts — the frontend's request/response shapes for every
 * backend endpoint the app calls.
 *
 * Most of these are GENERATED from the backend's OpenAPI schema
 * (projects/backend/openapi.json) via `npm run generate:contracts` (issue
 * #196). CI regenerates and diffs them on every push, so a backend schema
 * change that isn't reflected here fails the build instead of drifting
 * silently. `common.contract.ts` and `reference.contract.ts` are
 * exceptions — hand-written, since their endpoints hand-build a response
 * shape openapi-typescript can't see (see their own header comments).
 */

export * from './common.contract';
export * from './farmer.contract';
export * from './auth.contract';
export * from './farm.contract';
export * from './land.contract';
export * from './crop.contract';
export * from './activity.contract';
export * from './expense.contract';
export * from './attachment.contract';
export * from './reference.contract';
