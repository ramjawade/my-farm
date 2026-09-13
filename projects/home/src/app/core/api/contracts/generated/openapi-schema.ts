/**
 * GENERATED — do not edit by hand. Run `npm run generate:contracts` to update.
 * Full raw type output from projects/backend/openapi.json via openapi-typescript.
 */

export interface paths {
  '/api/v1/activities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Activities
     * @description List activities for the current farmer.
     *
     *     With no query params, behaves exactly as before (everything, newest
     *     updated first) via `activity_repo.list_all`. `status` (repeatable),
     *     `crop_id`, `sort` and `limit` are additive filters for callers that
     *     need a targeted slice (e.g. the activity dashboard's upcoming/recent
     *     lists) instead of the full list.
     */
    get: operations['list_activities_api_v1_activities_get'];
    put?: never;
    /**
     * Create Activity
     * @description Create a new activity.
     */
    post: operations['create_activity_api_v1_activities_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/expenses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List All Expenses
     * @description List all expenses for the current farmer (joined through activities).
     */
    get: operations['list_all_expenses_api_v1_activities_expenses_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Activities Summary
     * @description KPI counts + total expense for the current farmer, optionally scoped to a crop.
     *
     *     Computed server-side (aggregate queries) rather than shipping the full
     *     activity list just to count/sum it client-side.
     */
    get: operations['get_activities_summary_api_v1_activities_summary_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Activity
     * @description Get a single activity by ID.
     */
    get: operations['get_activity_api_v1_activities__activity_id__get'];
    put?: never;
    post?: never;
    /**
     * Delete Activity
     * @description Soft-delete an activity.
     */
    delete: operations['delete_activity_api_v1_activities__activity_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update Activity
     * @description Update an activity.
     */
    patch: operations['update_activity_api_v1_activities__activity_id__patch'];
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/attachments': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Activity Attachments
     * @description List attachments for a specific activity, cursor-paginated.
     */
    get: operations['list_activity_attachments_api_v1_activities__activity_id__attachments_get'];
    put?: never;
    /**
     * Create Activity Attachment
     * @description Create a new attachment for an activity.
     */
    post: operations['create_activity_attachment_api_v1_activities__activity_id__attachments_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/attachments/upload': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Get Attachment Upload Url
     * @description Get a presigned URL for uploading an attachment to R2.
     *
     *     The client uploads the file directly to the URL, then calls POST /{activity_id}/attachments
     *     with the storage_key and file metadata.
     */
    post: operations['get_attachment_upload_url_api_v1_activities__activity_id__attachments_upload_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/attachments/{attachment_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete Activity Attachment
     * @description Soft-delete an attachment for an activity.
     *
     *     Also deletes the file from R2 storage if configured.
     */
    delete: operations['delete_activity_attachment_api_v1_activities__activity_id__attachments__attachment_id__delete'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/expenses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Activity Expenses
     * @description List expenses for a specific activity, cursor-paginated.
     */
    get: operations['list_activity_expenses_api_v1_activities__activity_id__expenses_get'];
    put?: never;
    /**
     * Create Activity Expense
     * @description Create a new expense for an activity.
     */
    post: operations['create_activity_expense_api_v1_activities__activity_id__expenses_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/expenses/{expense_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /**
     * Delete Activity Expense
     * @description Soft-delete an expense for an activity.
     */
    delete: operations['delete_activity_expense_api_v1_activities__activity_id__expenses__expense_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update Activity Expense
     * @description Update an expense for an activity.
     */
    patch: operations['update_activity_expense_api_v1_activities__activity_id__expenses__expense_id__patch'];
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Activity History
     * @description Get the audit-trail/history entries for a single activity, newest first.
     */
    get: operations['get_activity_history_api_v1_activities__activity_id__history_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/activities/{activity_id}/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Activity Detail Summary
     * @description Get per-activity KPI summary: total expense, expense count, age, status.
     */
    get: operations['get_activity_detail_summary_api_v1_activities__activity_id__summary_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/seed-reference-data': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Seed Reference Data
     * @description Seed reference tables with initial data.
     *
     *     Idempotent: skips records that already exist (by name).
     */
    post: operations['seed_reference_data_api_v1_admin_seed_reference_data_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Register
     * @description Create a PIN account and hand back a session JWT.
     */
    post: operations['register_api_v1_auth_register_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Create Session
     * @description Verify phone + PIN, issue a session JWT.
     *
     *     The status code tells the login screen what to do next, so it never has
     *     to pre-check whether an account exists (issue #50):
     *
     *     - **404** — no account for this phone → the client offers to register.
     *     - **401** — account exists, wrong PIN → the client says "incorrect PIN".
     *     - **200** — `{ token, farmer }`.
     */
    post: operations['create_session_api_v1_auth_session_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/whoami': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Whoami
     * @description Proves the auth dependency end to end: reject anything that isn't a
     *     live Firebase ID token or a valid backend session JWT; otherwise return
     *     exactly what was verified.
     */
    get: operations['whoami_api_v1_auth_whoami_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/crops': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Crops
     * @description List all crops for the current farmer.
     */
    get: operations['list_crops_api_v1_crops_get'];
    put?: never;
    /**
     * Create Crop
     * @description Create a new crop.
     */
    post: operations['create_crop_api_v1_crops_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/crops/{crop_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Crop
     * @description Get a single crop by ID.
     */
    get: operations['get_crop_api_v1_crops__crop_id__get'];
    put?: never;
    post?: never;
    /**
     * Delete Crop
     * @description Soft-delete a crop.
     */
    delete: operations['delete_crop_api_v1_crops__crop_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update Crop
     * @description Update a crop.
     */
    patch: operations['update_crop_api_v1_crops__crop_id__patch'];
    trace?: never;
  };
  '/api/v1/farms': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Farms
     * @description List all farms for the current farmer.
     */
    get: operations['list_farms_api_v1_farms_get'];
    put?: never;
    /**
     * Create Farm
     * @description Create a new farm.
     */
    post: operations['create_farm_api_v1_farms_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/farms/{farm_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Farm
     * @description Get a single farm by ID.
     */
    get: operations['get_farm_api_v1_farms__farm_id__get'];
    put?: never;
    post?: never;
    /**
     * Delete Farm
     * @description Soft-delete a farm.
     */
    delete: operations['delete_farm_api_v1_farms__farm_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update Farm
     * @description Update a farm.
     */
    patch: operations['update_farm_api_v1_farms__farm_id__patch'];
    trace?: never;
  };
  '/api/v1/lands': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Lands
     * @description List all lands for the current farmer.
     */
    get: operations['list_lands_api_v1_lands_get'];
    put?: never;
    /**
     * Create Land
     * @description Create a new land.
     */
    post: operations['create_land_api_v1_lands_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/lands/{land_id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Land
     * @description Get a single land by ID.
     */
    get: operations['get_land_api_v1_lands__land_id__get'];
    put?: never;
    post?: never;
    /**
     * Delete Land
     * @description Soft-delete a land.
     */
    delete: operations['delete_land_api_v1_lands__land_id__delete'];
    options?: never;
    head?: never;
    /**
     * Update Land
     * @description Update a land.
     */
    patch: operations['update_land_api_v1_lands__land_id__patch'];
    trace?: never;
  };
  '/api/v1/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Current Farmer
     * @description Get the current authenticated farmer, provisioning on first call.
     *
     *     JIT-creates a farmer row on first successful token verification, then
     *     returns it. Subsequent calls fetch the existing row.
     *
     *     Accepts either a Firebase ID token or a backend-issued session JWT.
     */
    get: operations['get_current_farmer_api_v1_me_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Update Current Farmer
     * @description Partial-update the current farmer's profile fields.
     *
     *     Only the keys present in the request body are changed. The farmer row
     *     must already exist (call `GET /api/v1/me` once first — every
     *     authenticated entry point does).
     */
    patch: operations['update_current_farmer_api_v1_me_patch'];
    trace?: never;
  };
  '/api/v1/reference/activity-types': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Activity Types
     * @description List all available activity types.
     */
    get: operations['list_activity_types_api_v1_reference_activity_types_get'];
    put?: never;
    /**
     * Create Or Get Activity Type
     * @description Create a new activity type or return the existing one (case-insensitive).
     */
    post: operations['create_or_get_activity_type_api_v1_reference_activity_types_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/reference/crop-stages': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Crop Stages
     * @description List all available crop stages.
     */
    get: operations['list_crop_stages_api_v1_reference_crop_stages_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/reference/crops': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Crop Catalog
     * @description List all available crops from the catalog.
     */
    get: operations['list_crop_catalog_api_v1_reference_crops_get'];
    put?: never;
    /**
     * Create Or Get Crop
     * @description Create a new crop or return the existing one (case-insensitive).
     */
    post: operations['create_or_get_crop_api_v1_reference_crops_post'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/reference/expense-categories': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Expense Categories
     * @description List all available expense categories.
     */
    get: operations['list_expense_categories_api_v1_reference_expense_categories_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/reference/seasons': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List Seasons
     * @description List all available seasons.
     */
    get: operations['list_seasons_api_v1_reference_seasons_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/weather': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get Weather Data
     * @description Get weather for coordinates (tenant-scoped by Firebase token).
     *
     *     Returns cached data if available, falls back to mock data if API unavailable.
     */
    get: operations['get_weather_data_api_v1_weather_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Health
     * @description Unauthenticated liveness check — what CI and Render's health probe hit.
     */
    get: operations['health_health_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /**
     * ActivityAttachmentCreate
     * @description Create an activity attachment (activity_id is from URL path).
     */
    ActivityAttachmentCreate: {
      /** Content Type */
      content_type?: string | null;
      /** Size Bytes */
      size_bytes?: number | null;
      /** Storage Key */
      storage_key: string;
    };
    /**
     * ActivityAttachmentRead
     * @description Read an activity attachment record.
     */
    ActivityAttachmentRead: {
      /** Activity Id */
      activity_id: number;
      /** Content Type */
      content_type?: string | null;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Deleted At */
      deleted_at?: string | null;
      /** Id */
      id: number;
      /** Size Bytes */
      size_bytes?: number | null;
      /** Storage Key */
      storage_key: string;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
    };
    /**
     * ActivityAttachmentUploadRequest
     * @description Request a presigned upload URL for an attachment.
     */
    ActivityAttachmentUploadRequest: {
      /**
       * Content Type
       * @default application/octet-stream
       */
      content_type: string;
      /** Filename */
      filename: string;
    };
    /**
     * ActivityAttachmentUploadResponse
     * @description Response with presigned upload URL.
     */
    ActivityAttachmentUploadResponse: {
      /** Expires In */
      expires_in: number;
      /** Storage Key */
      storage_key: string;
      /** Upload Url */
      upload_url: string;
    };
    /**
     * ActivityCreate
     * @description Create an activity.
     */
    ActivityCreate: {
      /** Activity Meta */
      activity_meta?: {
        [key: string]: unknown;
      } | null;
      /** Activity Type Id */
      activity_type_id: number;
      /** Crop Id */
      crop_id?: number | null;
      /** Custom Activity Name */
      custom_activity_name?: string | null;
      /** Date */
      date?: string | null;
      /** Land Id */
      land_id?: number | null;
      /** Notes */
      notes?: string | null;
      /** Parent Activity Id */
      parent_activity_id?: number | null;
      /** Season */
      season?: string | null;
      /**
       * Status
       * @default pending
       */
      status: string;
    };
    /**
     * ActivityDetailSummaryRead
     * @description KPI summary for a single activity — GET /activities/{id}/summary.
     */
    ActivityDetailSummaryRead: {
      /** Days Since Created */
      days_since_created: number;
      /** Expense Count */
      expense_count: number;
      /** Status */
      status: string;
      /** Total Expense */
      total_expense: number;
    };
    /**
     * ActivityExpenseCreate
     * @description Create an activity expense (activity_id is from URL path).
     */
    ActivityExpenseCreate: {
      /** Amount */
      amount?: number | string | null;
      /** Expense Category Id */
      expense_category_id: number;
      /** Item Id */
      item_id?: string | null;
      /** Quantity */
      quantity?: number | string | null;
      /** Rate */
      rate?: number | string | null;
      /** Remarks */
      remarks?: string | null;
      /** Resource Id */
      resource_id?: string | null;
      /** Unit */
      unit?: string | null;
    };
    /**
     * ActivityExpenseRead
     * @description Read an activity expense record.
     */
    ActivityExpenseRead: {
      /** Activity Id */
      activity_id: number;
      /** Amount */
      amount?: string | null;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Deleted At */
      deleted_at?: string | null;
      /** Expense Category Id */
      expense_category_id: number;
      /** Id */
      id: number;
      /** Item Id */
      item_id?: string | null;
      /** Quantity */
      quantity?: string | null;
      /** Rate */
      rate?: string | null;
      /** Remarks */
      remarks?: string | null;
      /** Resource Id */
      resource_id?: string | null;
      /** Unit */
      unit?: string | null;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
    };
    /**
     * ActivityExpenseUpdate
     * @description Update activity expense fields.
     */
    ActivityExpenseUpdate: {
      /** Amount */
      amount?: number | string | null;
      /** Expense Category Id */
      expense_category_id?: number | null;
      /** Item Id */
      item_id?: string | null;
      /** Quantity */
      quantity?: number | string | null;
      /** Rate */
      rate?: number | string | null;
      /** Remarks */
      remarks?: string | null;
      /** Resource Id */
      resource_id?: string | null;
      /** Unit */
      unit?: string | null;
    };
    /**
     * ActivityRead
     * @description Read an activity record.
     */
    ActivityRead: {
      /** Activity Meta */
      activity_meta?: {
        [key: string]: unknown;
      } | null;
      /** Activity Type Id */
      activity_type_id: number;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Crop Id */
      crop_id?: number | null;
      /** Custom Activity Name */
      custom_activity_name?: string | null;
      /** Date */
      date?: string | null;
      /** Deleted At */
      deleted_at?: string | null;
      /** Farmer Id */
      farmer_id: number;
      /** Id */
      id: number;
      /** Land Id */
      land_id?: number | null;
      /** Notes */
      notes?: string | null;
      /** Parent Activity Id */
      parent_activity_id?: number | null;
      /** Season */
      season?: string | null;
      /**
       * Status
       * @default pending
       */
      status: string;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
    };
    /**
     * ActivitySummaryRead
     * @description KPI counts + total expense for GET /activities/summary.
     */
    ActivitySummaryRead: {
      /** Completed */
      completed: number;
      /** In Progress */
      in_progress: number;
      /** Total */
      total: number;
      /** Total Expense */
      total_expense: number;
    };
    /**
     * ActivityTypeCreate
     * @description Create a new activity type.
     */
    ActivityTypeCreate: {
      /** Name */
      name: string;
    };
    /**
     * ActivityTypeRead
     * @description Read an activity type record.
     */
    ActivityTypeRead: {
      /** Id */
      id: number;
      /** Name */
      name: string;
    };
    /**
     * ActivityUpdate
     * @description Update activity fields.
     */
    ActivityUpdate: {
      /** Activity Meta */
      activity_meta?: {
        [key: string]: unknown;
      } | null;
      /** Activity Type Id */
      activity_type_id?: number | null;
      /** Crop Id */
      crop_id?: number | null;
      /** Custom Activity Name */
      custom_activity_name?: string | null;
      /** Date */
      date?: string | null;
      /** Land Id */
      land_id?: number | null;
      /** Notes */
      notes?: string | null;
      /** Parent Activity Id */
      parent_activity_id?: number | null;
      /** Season */
      season?: string | null;
      /** Status */
      status?: string | null;
    };
    /**
     * CropCatalogCreate
     * @description Create a new crop catalog entry.
     */
    CropCatalogCreate: {
      /** Name */
      name: string;
    };
    /**
     * CropCatalogRead
     * @description Read a crop catalog record.
     */
    CropCatalogRead: {
      /** Common Names */
      common_names?: string | null;
      /** Id */
      id: number;
      /** Name */
      name: string;
    };
    /**
     * CropCreate
     * @description Create a crop.
     */
    CropCreate: {
      /** Area */
      area?: number | string | null;
      /**
       * Area Unit
       * @default sq_m
       */
      area_unit: string;
      /** Crop Catalog Id */
      crop_catalog_id: number;
      /** Current Stage */
      current_stage?: string | null;
      /** Expected Harvest Date */
      expected_harvest_date?: string | null;
      /** Label */
      label?: string | null;
      /** Land Id */
      land_id: number;
      /** Season */
      season?: string | null;
      /** Sowing Date */
      sowing_date?: string | null;
      /**
       * Status
       * @default active
       */
      status: string;
    };
    /**
     * CropRead
     * @description Read a crop record.
     */
    CropRead: {
      /** Area */
      area?: string | null;
      /**
       * Area Unit
       * @default sq_m
       */
      area_unit: string;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Crop Catalog Id */
      crop_catalog_id: number;
      /** Current Stage */
      current_stage?: string | null;
      /** Deleted At */
      deleted_at?: string | null;
      /** Expected Harvest Date */
      expected_harvest_date?: string | null;
      /** Farmer Id */
      farmer_id: number;
      /** Id */
      id: number;
      /** Label */
      label?: string | null;
      /** Land Id */
      land_id: number;
      /** Season */
      season?: string | null;
      /** Sowing Date */
      sowing_date?: string | null;
      /**
       * Status
       * @default active
       */
      status: string;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
    };
    /**
     * CropUpdate
     * @description Update crop fields.
     */
    CropUpdate: {
      /** Area */
      area?: number | string | null;
      /** Area Unit */
      area_unit?: string | null;
      /** Current Stage */
      current_stage?: string | null;
      /** Expected Harvest Date */
      expected_harvest_date?: string | null;
      /** Label */
      label?: string | null;
      /** Season */
      season?: string | null;
      /** Sowing Date */
      sowing_date?: string | null;
      /** Status */
      status?: string | null;
    };
    /**
     * FarmCreate
     * @description Create a farm.
     */
    FarmCreate: {
      /** Area */
      area?: number | string | null;
      /**
       * Area Unit
       * @default sq_m
       */
      area_unit: string;
      /** District */
      district?: string | null;
      /** Farming Method */
      farming_method?: string | null;
      /** Irrigation Type */
      irrigation_type?: string | null;
      /** Lat */
      lat?: number | string | null;
      /** Lng */
      lng?: number | string | null;
      /** Location Type */
      location_type?: string | null;
      /** Name */
      name: string;
      /** Pincode */
      pincode?: string | null;
      /** State */
      state?: string | null;
      /** Village */
      village?: string | null;
      /** Water Source */
      water_source?: string | null;
    };
    /**
     * FarmRead
     * @description Read a farm record.
     */
    FarmRead: {
      /** Area */
      area?: string | null;
      /**
       * Area Unit
       * @default sq_m
       */
      area_unit: string;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Deleted At */
      deleted_at?: string | null;
      /** District */
      district?: string | null;
      /** Farmer Id */
      farmer_id: number;
      /** Farming Method */
      farming_method?: string | null;
      /** Id */
      id: number;
      /** Irrigation Type */
      irrigation_type?: string | null;
      /** Lat */
      lat?: string | null;
      /** Lng */
      lng?: string | null;
      /** Location Type */
      location_type?: string | null;
      /** Name */
      name: string;
      /** Pincode */
      pincode?: string | null;
      /** Setup Completed */
      setup_completed: boolean;
      /** State */
      state?: string | null;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
      /** Village */
      village?: string | null;
      /** Water Source */
      water_source?: string | null;
    };
    /**
     * FarmUpdate
     * @description Update farm fields.
     */
    FarmUpdate: {
      /** Area */
      area?: number | string | null;
      /** Area Unit */
      area_unit?: string | null;
      /** District */
      district?: string | null;
      /** Farming Method */
      farming_method?: string | null;
      /** Irrigation Type */
      irrigation_type?: string | null;
      /** Lat */
      lat?: number | string | null;
      /** Lng */
      lng?: number | string | null;
      /** Location Type */
      location_type?: string | null;
      /** Name */
      name?: string | null;
      /** Pincode */
      pincode?: string | null;
      /** State */
      state?: string | null;
      /** Village */
      village?: string | null;
      /** Water Source */
      water_source?: string | null;
    };
    /**
     * FarmerRead
     * @description Read a farmer record (current authenticated farmer).
     */
    FarmerRead: {
      /** Auth Uid */
      auth_uid: string;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Deleted At */
      deleted_at?: string | null;
      /** Email */
      email?: string | null;
      /** Full Name */
      full_name?: string | null;
      /** Id */
      id: number;
      /** Phone */
      phone?: string | null;
      /**
       * Preferred Language
       * @default en
       */
      preferred_language: string;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
      /** User Role */
      user_role: string;
    };
    /**
     * FarmerUpdate
     * @description Update farmer profile fields.
     */
    FarmerUpdate: {
      /** Email */
      email?: string | null;
      /** Full Name */
      full_name?: string | null;
      /** Preferred Language */
      preferred_language?: string | null;
    };
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: components['schemas']['ValidationError'][];
    };
    /**
     * LandCreate
     * @description Create a land.
     */
    LandCreate: {
      /** Area Sq M */
      area_sq_m?: number | string | null;
      /** Farm Id */
      farm_id: number;
      /** Name */
      name: string;
      /** Notes */
      notes?: string | null;
      /** Points */
      points?: components['schemas']['LandPoint-Input'][] | null;
    };
    /**
     * LandPoint
     * @description A GPS coordinate polygon vertex.
     */
    'LandPoint-Input': {
      /** Lat */
      lat: number | string;
      /** Lng */
      lng: number | string;
    };
    /**
     * LandPoint
     * @description A GPS coordinate polygon vertex.
     */
    'LandPoint-Output': {
      /** Lat */
      lat: string;
      /** Lng */
      lng: string;
    };
    /**
     * LandRead
     * @description Read a land record.
     */
    LandRead: {
      /** Area Sq M */
      area_sq_m?: string | null;
      /**
       * Created At
       * Format: date-time
       */
      created_at: string;
      /** Deleted At */
      deleted_at?: string | null;
      /** Farm Id */
      farm_id: number;
      /** Farmer Id */
      farmer_id: number;
      /** Id */
      id: number;
      /** Name */
      name: string;
      /** Notes */
      notes?: string | null;
      /** Points */
      points?: components['schemas']['LandPoint-Output'][] | null;
      /**
       * Updated At
       * Format: date-time
       */
      updated_at: string;
    };
    /**
     * LandUpdate
     * @description Update land fields.
     */
    LandUpdate: {
      /** Area Sq M */
      area_sq_m?: number | string | null;
      /** Name */
      name?: string | null;
      /** Notes */
      notes?: string | null;
      /** Points */
      points?: components['schemas']['LandPoint-Input'][] | null;
    };
    /**
     * RegisterRequest
     * @description Create a PIN account.
     */
    RegisterRequest: {
      /** Full Name */
      full_name: string;
      /** Phone */
      phone: string;
      /** Pin */
      pin: string;
      /**
       * Preferred Language
       * @default en
       */
      preferred_language: string;
    };
    /**
     * SessionRequest
     * @description Log in an existing PIN account.
     */
    SessionRequest: {
      /** Phone */
      phone: string;
      /** Pin */
      pin: string;
    };
    /**
     * SessionResponse
     * @description A freshly issued session JWT plus the farmer it belongs to.
     */
    SessionResponse: {
      farmer: components['schemas']['FarmerRead'];
      /** Token */
      token: string;
    };
    /** ValidationError */
    ValidationError: {
      /** Context */
      ctx?: Record<string, never>;
      /** Input */
      input?: unknown;
      /** Location */
      loc: (string | number)[];
      /** Message */
      msg: string;
      /** Error Type */
      type: string;
    };
    /**
     * WeatherResponse
     * @description Weather data response.
     */
    WeatherResponse: {
      /** Cached At */
      cached_at?: string | null;
      /** Data */
      data: {
        [key: string]: unknown;
      };
      /** Fetched At */
      fetched_at?: string | null;
      /** Source */
      source: string;
      /** Warning */
      warning?: string | null;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  list_activities_api_v1_activities_get: {
    parameters: {
      query?: {
        status?: string[] | null;
        crop_id?: number | null;
        sort?: string | null;
        limit?: number | null;
      };
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_activity_api_v1_activities_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_all_expenses_api_v1_activities_expenses_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_activities_summary_api_v1_activities_summary_get: {
    parameters: {
      query?: {
        crop_id?: number | null;
      };
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivitySummaryRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_activity_api_v1_activities__activity_id__get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_activity_api_v1_activities__activity_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_activity_api_v1_activities__activity_id__patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_activity_attachments_api_v1_activities__activity_id__attachments_get: {
    parameters: {
      query?: {
        cursor?: string | null;
        limit?: number;
      };
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_activity_attachment_api_v1_activities__activity_id__attachments_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityAttachmentCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityAttachmentRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_attachment_upload_url_api_v1_activities__activity_id__attachments_upload_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityAttachmentUploadRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityAttachmentUploadResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_activity_attachment_api_v1_activities__activity_id__attachments__attachment_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
        attachment_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_activity_expenses_api_v1_activities__activity_id__expenses_get: {
    parameters: {
      query?: {
        cursor?: string | null;
        limit?: number;
      };
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_activity_expense_api_v1_activities__activity_id__expenses_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityExpenseCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityExpenseRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_activity_expense_api_v1_activities__activity_id__expenses__expense_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
        expense_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_activity_expense_api_v1_activities__activity_id__expenses__expense_id__patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
        expense_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityExpenseUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityExpenseRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_activity_history_api_v1_activities__activity_id__history_get: {
    parameters: {
      query?: {
        limit?: number;
      };
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_activity_detail_summary_api_v1_activities__activity_id__summary_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        activity_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityDetailSummaryRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  seed_reference_data_api_v1_admin_seed_reference_data_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  register_api_v1_auth_register_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RegisterRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SessionResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_session_api_v1_auth_session_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['SessionRequest'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SessionResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  whoami_api_v1_auth_whoami_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: string | null;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_crops_api_v1_crops_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_crop_api_v1_crops_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CropCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CropRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_crop_api_v1_crops__crop_id__get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        crop_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CropRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_crop_api_v1_crops__crop_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        crop_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_crop_api_v1_crops__crop_id__patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        crop_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CropUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CropRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_farms_api_v1_farms_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_farm_api_v1_farms_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['FarmCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FarmRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_farm_api_v1_farms__farm_id__get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        farm_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FarmRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_farm_api_v1_farms__farm_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        farm_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_farm_api_v1_farms__farm_id__patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        farm_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['FarmUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FarmRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_lands_api_v1_lands_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  create_land_api_v1_lands_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['LandCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LandRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_land_api_v1_lands__land_id__get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        land_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LandRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  delete_land_api_v1_lands__land_id__delete: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        land_id: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_land_api_v1_lands__land_id__patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path: {
        land_id: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['LandUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LandRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  get_current_farmer_api_v1_me_get: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FarmerRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  update_current_farmer_api_v1_me_patch: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['FarmerUpdate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['FarmerRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_activity_types_api_v1_reference_activity_types_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  create_or_get_activity_type_api_v1_reference_activity_types_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ActivityTypeCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ActivityTypeRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_crop_stages_api_v1_reference_crop_stages_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  list_crop_catalog_api_v1_reference_crops_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  create_or_get_crop_api_v1_reference_crops_post: {
    parameters: {
      query?: never;
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CropCatalogCreate'];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CropCatalogRead'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  list_expense_categories_api_v1_reference_expense_categories_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  list_seasons_api_v1_reference_seasons_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  get_weather_data_api_v1_weather_get: {
    parameters: {
      query: {
        /** @description Latitude */
        lat: number | string;
        /** @description Longitude */
        lng: number | string;
      };
      header?: {
        authorization?: string | null;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WeatherResponse'];
        };
      };
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HTTPValidationError'];
        };
      };
    };
  };
  health_health_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: string;
          };
        };
      };
    };
  };
}
