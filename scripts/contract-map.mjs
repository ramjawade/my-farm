/**
 * Hand-maintained glue between backend Pydantic schema names (as they show
 * up in `projects/backend/openapi.json`) and the frontend's existing
 * `core/api/contracts/*.contract.ts` export names.
 *
 * This is the ONE file a person touches when a new entity or endpoint is
 * added — not on every field change (that part is fully generated). To add
 * a new contract file: add an entry below, run `npm run generate:contracts`.
 *
 * Files not listed here (`common.contract.ts`, `reference.contract.ts`) stay
 * 100% hand-written — see their own header comments for why (they describe
 * hand-built response envelopes / endpoints with no stable `response_model`
 * for openapi-typescript to read).
 */

export const CONTRACT_FILES = [
  {
    file: 'activity.contract.ts',
    header: `/**
 * Activities — a logged farm activity (sowing, spraying, harvest, …).
 *
 *   GET    /api/v1/activities        -> CursorPage<ActivityResponse>
 *   GET    /api/v1/activities/{id}   -> ActivityResponse
 *   POST   /api/v1/activities        -> ActivityResponse   (201)
 *   PATCH  /api/v1/activities/{id}   -> ActivityResponse
 *   DELETE /api/v1/activities/{id}   -> 204
 *
 * \`activity_type_id\` is an FK into the seeded reference table, resolved by
 * \`ReferenceDataService\`. Nested expenses/attachments live in their own
 * contract modules.
 */`,
    exports: [
      { name: 'ActivityResponse', schema: 'ActivityRead' },
      { name: 'ActivityCreateRequest', schema: 'ActivityCreate' },
      { name: 'ActivityUpdateRequest', schema: 'ActivityUpdate' },
    ],
  },
  {
    file: 'expense.contract.ts',
    header: `/**
 * Activity expenses — cost lines nested under an activity.
 *
 *   GET    /api/v1/activities/{aid}/expenses          -> CursorPage<ExpenseResponse>
 *   POST   /api/v1/activities/{aid}/expenses          -> ExpenseResponse   (201)
 *   PATCH  /api/v1/activities/{aid}/expenses/{id}     -> ExpenseResponse
 *   DELETE /api/v1/activities/{aid}/expenses/{id}     -> 204
 *
 * The owning \`activity_id\` is always taken from the URL path; the create
 * body doesn't carry it. \`expense_category_id\` is a reference-table FK.
 */`,
    exports: [
      { name: 'ExpenseResponse', schema: 'ActivityExpenseRead' },
      { name: 'ExpenseCreateRequest', schema: 'ActivityExpenseCreate' },
      { name: 'ExpenseUpdateRequest', schema: 'ActivityExpenseUpdate' },
    ],
  },
  {
    file: 'crop.contract.ts',
    header: `/**
 * Crops — a crop planted on a \`Land\`.
 *
 *   GET    /api/v1/crops        -> CursorPage<CropResponse>
 *   POST   /api/v1/crops        -> CropResponse   (201)
 *   PATCH  /api/v1/crops/{id}   -> CropResponse
 *   DELETE /api/v1/crops/{id}   -> 204
 *
 * \`crop_catalog_id\` is an FK into the seeded reference table —
 * \`ReferenceDataService\` resolves it to/from the client's free-text
 * \`cropType\`.
 */`,
    exports: [
      { name: 'CropResponse', schema: 'CropRead' },
      { name: 'CropCreateRequest', schema: 'CropCreate' },
      { name: 'CropUpdateRequest', schema: 'CropUpdate' },
    ],
  },
  {
    file: 'land.contract.ts',
    header: `/**
 * Lands — a drawn plot of land (Angular calls this a \`SavedFarm\`).
 *
 *   GET    /api/v1/lands        -> CursorPage<LandResponse>
 *   POST   /api/v1/lands        -> LandResponse   (201)
 *   PATCH  /api/v1/lands/{id}   -> LandResponse
 *   DELETE /api/v1/lands/{id}   -> 204
 *
 * The polygon itself (\`points\` / \`geoJson\` on the client) has no backend
 * column yet — only \`area_sq_m\` round-trips (see #193).
 */`,
    exports: [
      { name: 'LandResponse', schema: 'LandRead' },
      { name: 'LandCreateRequest', schema: 'LandCreate' },
      { name: 'LandUpdateRequest', schema: 'LandUpdate' },
    ],
  },
  {
    file: 'farm.contract.ts',
    header: `/**
 * Farms — the top-level holding a farmer's \`Land\` plots hang off.
 *
 *   GET   /api/v1/farms          -> CursorPage<FarmResponse>
 *   GET   /api/v1/farms/{id}     -> FarmResponse
 *   POST  /api/v1/farms          -> FarmResponse   (201)
 *   PATCH /api/v1/farms/{id}     -> FarmResponse
 *   DELETE /api/v1/farms/{id}    -> 204
 *
 * The Angular app has no multi-farm UI — \`ApiStorageService\` only
 * get-or-creates one default farm to satisfy \`Land.farm_id\`.
 */`,
    exports: [
      { name: 'FarmResponse', schema: 'FarmRead' },
      { name: 'FarmCreateRequest', schema: 'FarmCreate' },
      { name: 'FarmUpdateRequest', schema: 'FarmUpdate' },
    ],
  },
  {
    file: 'farmer.contract.ts',
    header: `/**
 * Farmer profile — \`GET /api/v1/me\`.
 *
 * Also the shape nested as \`farmer\` inside the auth endpoints' responses
 * (see \`auth.contract.ts\`).
 */`,
    exports: [
      { name: 'FarmerResponse', schema: 'FarmerRead' },
      { name: 'FarmerUpdateRequest', schema: 'FarmerUpdate' },
    ],
  },
  {
    file: 'attachment.contract.ts',
    header: `/**
 * Activity attachments — photos/files on an activity, stored by key.
 *
 *   GET    /api/v1/activities/{aid}/attachments         -> CursorPage<AttachmentResponse>
 *   POST   /api/v1/activities/{aid}/attachments         -> AttachmentResponse   (201)
 *   DELETE /api/v1/activities/{aid}/attachments/{id}    -> 204
 *   POST   /api/v1/activities/{aid}/attachments/upload-url -> AttachmentUploadResponse
 *
 * Not called by the frontend yet — the R2 upload flow is Stage 7 / a later
 * phase. Included here so that work starts from a written contract.
 */`,
    exports: [
      { name: 'AttachmentResponse', schema: 'ActivityAttachmentRead' },
      { name: 'AttachmentCreateRequest', schema: 'ActivityAttachmentCreate' },
      { name: 'AttachmentUploadRequest', schema: 'ActivityAttachmentUploadRequest' },
      { name: 'AttachmentUploadResponse', schema: 'ActivityAttachmentUploadResponse' },
    ],
  },
  {
    file: 'auth.contract.ts',
    header: `/**
 * PIN session auth (issues #45, #50) — consumed by \`SessionAuthService\`.
 *
 *   POST /api/v1/auth/session    -> SessionResponse
 *                                   404 = no account for that phone (offer register)
 *                                   401 = account exists, wrong PIN
 *   POST /api/v1/auth/register   -> SessionResponse   (409 if phone already taken)
 *
 * Auth is online-only — there is no offline path and no local fallback.
 */`,
    exports: [
      { name: 'SessionRequest', schema: 'SessionRequest' },
      { name: 'RegisterRequest', schema: 'RegisterRequest' },
      { name: 'SessionResponse', schema: 'SessionResponse' },
    ],
  },
];
