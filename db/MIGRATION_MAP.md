# localStorage → Firestore Migration Map

This document maps the current localStorage keys (used by the frontend in testing phase)
to their corresponding Firestore paths when the backend migrates to Firebase.

Real localStorage keys are tracked in:
- `projects/home/src/app/core/storage/local-storage.service.ts`
- Migration legacy handling in `projects/home/features/activity/migration.ts`

## Active localStorage Keys (Current)

These keys are actively written by the application and must be migrated.

| localStorage Key | Data Type | Firestore Path | Notes |
|---|---|---|---|
| `my_farm_${userId}_activities` | `Activity[]` (JSON) | `farmers/{userId}/activities/{id}` (collection) | All activities for the user |
| `my_farm_${userId}_activity_expenses` | `ActivityExpense[]` (JSON) | `farmers/{userId}/activities/{activityId}/expenses/{id}` (subcollection) | Expenses grouped by activity |
| `my_farm_${userId}_crops` | `CropEntity[]` (JSON) | `farmers/{userId}/crops/{id}` (collection) | All crops for the user |
| `my_farm_${userId}_saved_farms` | `SavedFarm[]` (JSON) | `farmers/{userId}/lands/{id}` (collection) | Land/farm records |
| `my_farm_${userId}_weather_history` | `WeatherData` (JSON) | `farmers/{userId}/weather/snapshots/{location}_{date}` | Current weather snapshots |

## Legacy localStorage Keys (Pre-Migration, Handled by Migration Service)

These keys are deprecated and handled by `features/activity/migration.ts`.
If legacy data exists, it must be migrated before deletion.

| localStorage Key | Data Type | Firestore Path | Deprecation Note |
|---|---|---|---|
| `my_farm_crop_timeline_activities` | `Activity[]` (JSON) | `farmers/{userId}/activities/{id}` | Pre-v0.1.0; merged into main activities |
| `my_farm_farm_activities_old` | `Activity[]` (JSON) | `farmers/{userId}/activities/{id}` | Schema v1; merged into main activities |
| `my_farm_activities_old` | `Activity[]` (JSON) | `farmers/{userId}/activities/{id}` | Schema v0; merged into main activities |

## Data Transformations During Migration

### Activities

**localStorage:** Array of `Activity` objects
```json
{
  "id": "uuid-string",
  "activity_type_id": "uuid-string",
  "crop_id": "uuid-string or null",
  "land_id": "uuid-string or null",
  "parent_activity_id": "uuid-string or null",
  "custom_activity_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "season": "string or null",
  "status": "pending|completed|...",
  "notes": "string or null",
  "activity_meta": {"...": "..."},
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "deleted_at": "ISO8601 timestamp or null"
}
```

**Firestore:** Individual documents in `farmers/{uid}/activities/{id}` collection
- Field rename: `activity_meta` → `metadata` (standardize naming)
- Timestamp conversion: ISO8601 strings → Firestore Timestamp objects
- No structural changes to relationships; `parent_activity_id` preserved for sub-activity linking

### Crops

**localStorage:** Array of `CropEntity` objects
```json
{
  "id": "uuid-string",
  "farmer_id": "uuid-string",
  "land_id": "uuid-string",
  "name": "string",
  "variety": "string or null",
  "sowing_date": "YYYY-MM-DD or null",
  "expected_harvest_date": "YYYY-MM-DD or null",
  "area": "number or null",
  "area_unit": "string or null",
  "status": "string or null",
  "notes": "string or null",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "deleted_at": "ISO8601 timestamp or null"
}
```

**Firestore:** Individual documents in `farmers/{uid}/crops/{id}` collection
- Timestamp conversion: ISO8601 strings → Firestore Timestamp objects
- No other structural changes

### Lands (Saved Farms)

**localStorage:** Array of `SavedFarm` objects
```json
{
  "id": "uuid-string",
  "farmer_id": "uuid-string",
  "name": "string",
  "total_area": "number or null",
  "area_unit": "string or null",
  "boundary_points": [
    {"latitude": "number", "longitude": "number"},
    ...
  ],
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "deleted_at": "ISO8601 timestamp or null"
}
```

**Firestore:** Individual documents in `farmers/{uid}/lands/{id}` collection
- Rename collection: `SavedFarm` → `land` (align with schema terminology)
- Timestamp conversion: ISO8601 strings → Firestore Timestamp objects
- `boundary_points` array preserved as-is (denormalized in Firestore; normalized in Postgres as `land_point` table)

### Weather History

**localStorage:** `WeatherData` object
```json
{
  "location": "string",
  "latitude": "number",
  "longitude": "number",
  "current_weather": {
    "date": "YYYY-MM-DD",
    "temperature": "number or null",
    "humidity": "number or null",
    "pressure": "number or null",
    "wind_speed": "number or null",
    "wind_direction": "string or null",
    "precipitation": "number or null",
    "description": "string or null"
  },
  "forecast_days": [
    {
      "forecast_date": "YYYY-MM-DD",
      "min_temperature": "number or null",
      "max_temperature": "number or null",
      "precipitation_probability": "number or null",
      "expected_precipitation": "number or null",
      "humidity": "number or null",
      "wind_speed": "number or null",
      "description": "string or null"
    },
    ...
  ],
  "alerts": [
    {
      "alert_type": "string",
      "severity": "string or null",
      "date": "YYYY-MM-DD",
      "description": "string or null",
      "recommendation": "string or null"
    },
    ...
  ]
}
```

**Firestore:** Split into multiple subcollections and documents
- Current weather → `farmers/{uid}/weather/snapshots/{location}_{date}`
- Forecasts → `farmers/{uid}/weather/forecasts/{location}_{forecast_date}` (one doc per day)
- Alerts → `farmers/{uid}/weather/alerts/{id}` (individual alert documents)
- Common fields (`location`, `latitude`, `longitude`, `farmer_id`) denormalized into each document for query convenience

## Activity Expenses Migration (Derived)

**Note:** `my_farm_${userId}_activity_expenses` in localStorage is currently a flat array.
In Firestore, expenses are organized as subcollection documents under their parent activity.

**Transformation:**
```
localStorage: [{activity_id: "...", expense_type: "...", amount: 123, ...}, ...]
         ↓
Firestore: farmers/{uid}/activities/{activity_id}/expenses/{expense_id}
```

During migration, group expenses by `activity_id` and batch-insert into the correct subcollection paths.

## Migration Steps (Proposed)

When real users exist and migration is triggered:

1. **Fetch all active localStorage keys** for the authenticated user
2. **Validate referential integrity** (all FK references resolve to existing docs)
3. **Batch write to Firestore** in dependency order:
   - Farmers (root doc)
   - Lands → Land points (if normalized)
   - Crops
   - Activities → Expenses and Attachments
   - Weather (snapshots, forecasts, alerts)
4. **Clean up legacy keys** after successful migration
5. **Set `legacyMigrationCompleted` flag** in farmer root doc

## Notes

- **No data loss during active testing:** Migration is write-forward; new data goes to Firestore only after migration completes.
- **Timestamp handling:** Firestore Timestamps have microsecond precision; ISO8601 strings have millisecond. Precision loss is acceptable for historical audit.
- **Activity attachments:** Currently stored as base64 in `activity.attachments[]` array. Will be formalized as separate `activity_attachment` documents in Firestore/Postgres.
- **RBAC migration:** If RBAC is implemented, `user_role` (free text) can be validated against `farmers_role` junction table during migration.
