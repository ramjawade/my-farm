# Firestore Collection Layout

This document describes the physical L3 layout of MyFarm data in Firestore, derived from `db/schema.ts`.
All data is organized by farmer (tenant) for proper isolation and access control.

## Root Level

Firestore uses a hierarchical collection/document structure:

```
firestore/
├── farmers/
│   └── {farmer_uid}/
│       ├── metadata (document)
│       ├── lands/ (collection)
│       ├── crops/ (collection)
│       ├── activities/ (collection)
│       └── weather/ (subcollection)
├── roles/ (global, read-only)
├── modules/ (global, read-only)
└── role_modules/ (global, read-only)
```

## Collections and Subcollections

### `farmers/{uid}` (Document)

**Parent:** Root

**Content:** Farmer profile and metadata

```typescript
{
  id: string;                    // Firebase Auth UID (email-based)
  email: string;
  name: string;
  location: string | null;
  experience: string | null;
  crops_interested: string[] | null;
  user_role: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

### `farmers/{uid}/lands` (Collection)

**Parent:** `farmers/{uid}`

**Documents:** Land records (farms/properties)

**Document ID:** UUID (land.id)

**Content:**

```typescript
{
  id: string;           // UUID
  farmer_id: string;    // Denormalized farmer UID for query convenience
  name: string;
  total_area: number | null;
  area_unit: string | null;
  boundary_points: GeoPoint[];  // Firestore GeoPoint array
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

**Note on boundary points:** The Postgres `land_point` table (normalized, ordered sequence)
is denormalized into a single `boundary_points` array in Firestore for simpler queries.
If field-level access control is needed per point, the normalized structure can be re-introduced
as a subcollection.

### `farmers/{uid}/lands/{land_id}/points` (Collection) [Optional]

If per-point access control or separate point mutation is needed, points can be a subcollection:

```typescript
{
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
}
```

For the MVP (current plan), points are denormalized into `boundary_points` array.

### `farmers/{uid}/crops` (Collection)

**Parent:** `farmers/{uid}`

**Document ID:** UUID (crop.id)

**Content:**

```typescript
{
  id: string;
  farmer_id: string;
  land_id: string;      // FK to lands/{land_id}
  name: string;
  variety: string | null;
  sowing_date: string | null;   // ISO 8601 date
  expected_harvest_date: string | null;
  area: number | null;
  area_unit: string | null;
  status: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

### `farmers/{uid}/activities` (Collection)

**Parent:** `farmers/{uid}`

**Document ID:** UUID (activity.id)

**Content:**

```typescript
{
  id: string;
  farmer_id: string;
  activity_type_id: string;
  crop_id: string | null;          // FK to crops/{crop_id}
  land_id: string | null;          // FK to lands/{land_id}
  parent_activity_id: string | null; // FK to activities/{activity_id}
  custom_activity_name: string | null;
  date: string | null;             // ISO 8601 date
  season: string | null;
  status: string;                  // pending, completed, cancelled, etc.
  notes: string | null;
  metadata: Record<string, any> | null; // Activity-type-specific fields
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
```

### `farmers/{uid}/activities/{activity_id}/expenses` (Collection)

**Parent:** `farmers/{uid}/activities/{activity_id}`

**Document ID:** UUID (activity_expense.id)

**Content:**

```typescript
{
  id: string;
  activity_id: string;    // Denormalized for convenience
  expense_type: string | null;
  amount: number;
  currency: string | null;
  description: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### `farmers/{uid}/activities/{activity_id}/attachments` (Collection)

**Parent:** `farmers/{uid}/activities/{activity_id}`

**Document ID:** UUID (activity_attachment.id)

**Content:**

```typescript
{
  id: string;
  activity_id: string;    // Denormalized for convenience
  filename: string;
  mime_type: string;
  data_uri: string;       // Base64-encoded file data as data: URI
  created_at: Timestamp;
}
```

### `farmers/{uid}/weather` (Subcollection)

**Parent:** `farmers/{uid}`

#### `weather/snapshots` (Collection)

**Document ID:** Composite key `{location}_{date}` (e.g., `delhi_2026-09-08`)

**Content:**

```typescript
{
  id: string;
  farmer_id: string;
  location: string;
  latitude: number;
  longitude: number;
  date: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: string | null;
  precipitation: number | null;
  description: string | null;
  created_at: Timestamp;
}
```

#### `weather/forecasts` (Collection)

**Document ID:** Composite key `{location}_{forecast_date}` (e.g., `delhi_2026-09-10`)

**Content:**

```typescript
{
  id: string;
  farmer_id: string;
  location: string;
  latitude: number;
  longitude: number;
  date: string;              // Date forecast was made
  forecast_date: string;     // Date being forecast
  min_temperature: number | null;
  max_temperature: number | null;
  precipitation_probability: number | null;
  expected_precipitation: number | null;
  humidity: number | null;
  wind_speed: number | null;
  description: string | null;
  created_at: Timestamp;
}
```

#### `weather/alerts` (Collection)

**Document ID:** UUID (weather_alert.id)

**Content:**

```typescript
{
  id: string;
  farmer_id: string;
  location: string;
  latitude: number;
  longitude: number;
  alert_type: string;       // frost, drought, excess_rain, heat_wave, pest_risk, etc.
  severity: string | null;  // low, medium, high, critical
  date: string;
  description: string | null;
  recommendation: string | null;
  created_at: Timestamp;
}
```

## Global Reference Collections (Read-Only)

These collections are not farmer-scoped and are shared across all users.

### `roles` (Collection)

**Document ID:** UUID (role.id)

**Content:**

```typescript
{
  id: string;
  name: string;
  description: string | null;
  created_at: Timestamp;
}
```

### `modules` (Collection)

**Document ID:** UUID (module.id)

**Content:**

```typescript
{
  id: string;
  name: string;
  description: string | null;
  created_at: Timestamp;
}
```

### `role_modules` (Collection)

**Document ID:** UUID (role_module.id)

**Content:**

```typescript
{
  id: string;
  role_id: string;
  module_id: string;
  created_at: Timestamp;
}
```

## Composite Index Requirements

See `firestore.indexes.json` for the complete index configuration. Key indexes:

1. **Activities by farmer and date:** `farmers/{uid}/activities` on `(farmer_id, date DESC)`
2. **Activities by farmer and status:** `farmers/{uid}/activities` on `(farmer_id, status)`
3. **Activities by parent:** `farmers/{uid}/activities` on `(farmer_id, parent_activity_id)`
4. **Crops by farmer and land:** `farmers/{uid}/crops` on `(farmer_id, land_id)`
5. **Weather snapshots by location and date:** `farmers/{uid}/weather/snapshots` on `(farmer_id, location, date DESC)`
6. **Weather forecasts by forecast date:** `farmers/{uid}/weather/forecasts` on `(farmer_id, forecast_date DESC)`

## Access Control Strategy

Security rules (see `firestore.rules`) enforce:

- **Per-farmer subtree:** Only the authenticated farmer can read/write their own data
- **Global reference data:** Any authenticated user can read `roles`, `modules`, `role_modules` (low-trust, informational)
- **No cross-farmer access:** Business logic and rules prevent data leakage

## Notes on Denormalization

Several fields are denormalized from Postgres for Firestore convenience:

- `farmer_id` appears in subcollections for query filtering (Firestore lacks implicit collection scoping in queries)
- `activity_id` is denormalized into `expenses` and `attachments` docs for easier batch operations
- `boundary_points` in `lands` document denormalizes the `land_point` table for simpler queries
- Activity `parent_activity_id` is kept as a foreign key reference; hierarchical queries are handled by fetching the parent doc

These denormalizations are intentional trade-offs to simplify query patterns in the current Firestore-only phase.
When migrating to Postgres, the normalized structure is already defined in the schema; the denormalized fields can be dropped from Firestore or kept for data migration validation.
