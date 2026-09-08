/**
 * MyFarm API contracts — hand-written, frontend-owned request/response
 * shapes for every backend endpoint the app calls (issue #49).
 *
 * These are the frontend's statement of what it expects from each endpoint.
 * They are not generated from, nor checked against, the backend's OpenAPI
 * spec — a contract regression surfaces in the Playwright golden-path E2E
 * (#44) and on staging, not at build time.
 *
 * Wiring `ApiStorageService` / `SessionAuthService` / `ReferenceDataService`
 * onto these types is #50 (Phase 4).
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
export * from './sync.contract';
