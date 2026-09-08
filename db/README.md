# MyFarm Database Schema

This directory contains the canonical database schema for the MyFarm application,
future-proofed for Postgres while currently running on Firebase.

## Overview

**One Schema, Two Backends:**

- **Current:** Firebase Firestore (NoSQL, real-time)
- **Future:** Postgres (relational, structured)

All schema definitions are derived from a single TypeScript source (`schema.ts`) to prevent
divergence between representations. Both Firestore and Postgres layouts are validated
against the same entity definitions.

## Structure

```
db/
├── README.md                      ← You are here
├── schema.ts                      ← Canonical entity/field definitions
├── MIGRATION_MAP.md               ← localStorage → Firestore mapping
├── migrations/
│   ├── 0001_init.sql             ← Core Postgres tables and indexes
│   └── 0002_rbac.sql             ← Proposed RBAC schema (optional)
└── firestore/
    ├── structure.md               ← L3 Firestore collection layout
    ├── firestore.rules            ← Security rules (per-farmer access)
    └── firestore.indexes.json     ← Composite index configuration
```

## Key Files

### `schema.ts`

**Purpose:** Single source of truth for all entities and fields.

Each entity includes:
- Entity name and description
- Source file reference (for verification against real code)
- Field definitions with:
  - TypeScript type (`tsType`)
  - SQL type (`sqlType`) — ready for Postgres
  - Nullability, uniqueness, primary/foreign key constraints
  - Field description

**Never edit schema manually.** Keep it synchronized with:
- Real TypeScript models (`FarmerRegistrationData`, `SavedFarm`, `CropEntity`, `Activity`, etc.)
- Backend Pydantic schemas (`activity.py`, etc.)
- Firestore documents (if structure drifts from schema, update schema.ts first, then Firestore)

Entities include:
- **Core:** `farmer`, `land`, `land_point`, `crop`, `activity`, `activity_expense`, `activity_attachment`
- **Weather:** `weather_snapshot`, `weather_forecast_day`, `weather_alert`
- **RBAC (proposed):** `role`, `farmer_role`, `module`, `role_module`

### `migrations/0001_init.sql`

**Purpose:** Postgres DDL for all core tables and indexes.

Traits:
- Creates extensions (`uuid-ossp`)
- Defines all entity tables with constraints (PK, FK, UNIQUE, CHECK for enums)
- Adds covering indexes for common query patterns (farmer_id, date, status, etc.)
- Safe for production: uses `IF NOT EXISTS` where appropriate

**Not applied by default.** Use this for Postgres migration planning and validation.
Currently, the app uses Firestore; this is reference documentation.

### `migrations/0002_rbac.sql`

**Purpose:** Optional RBAC schema (role, farmer_role, module, role_module tables).

Traits:
- Completely separate from core schema; can be applied independently
- Includes optional seed data (commented out by default)
- Not yet integrated; `user_role` is currently free text

**When to use:** If/when RBAC is wired into the application, apply this migration
after `0001_init.sql` and add role validation logic to the backend.

### `firestore/structure.md`

**Purpose:** L3 detailed Firestore collection layout.

Covers:
- Collection hierarchy (`farmers/{uid}` subtrees, global reference data)
- Document schemas for each collection
- Denormalization rationale (why `farmer_id` appears in subcollections, etc.)
- Composite index requirements (which queries need indexes)
- Access control strategy (per-farmer subtrees, read-only global data)

**Keep synchronized with:** `schema.ts` and actual Firestore reads/writes.
If your queries need a new index or field, update this doc and add to `firestore.indexes.json`.

### `firestore/firestore.rules`

**Purpose:** Firestore security rules (access control).

Enforces:
- **Per-farmer subtrees:** Only the authenticated farmer can read/write their own `farmers/{uid}` data
- **Global reference data:** Any authenticated user can read `roles`, `modules`, `role_modules` (low-trust)
- **No cross-farmer access:** Business logic prevents data leakage

**Deployment:** Apply via Firebase Console or CLI:
```bash
firebase deploy --only firestore:rules
```

### `firestore/firestore.indexes.json`

**Purpose:** Composite index definitions for Firestore.

Includes indexes for:
- Activities by farmer + date (range queries)
- Activities by farmer + status (filtering)
- Activities by parent (sub-activity queries)
- Crops by farmer + land
- Weather snapshots/forecasts by location + date

**Deployment:** Apply via Firebase Console or CLI:
```bash
firebase deploy --only firestore:indexes
```

### `MIGRATION_MAP.md`

**Purpose:** Mapping from current localStorage keys (testing phase) to Firestore paths.

When real users exist and you migrate from localStorage → Firestore:
- Use this map to know where each localStorage array goes
- Follow the data transformation rules (timestamp conversion, field renames, etc.)
- Ensure referential integrity before writing
- Batch-insert in dependency order (farmers → lands → crops → activities → weather)

## Verification Against Source

All entity definitions in `schema.ts` have been verified against real source code:

### Frontend Models
- `projects/home/src/app/models/farmer-registration.models.ts` → `FarmerRegistrationData` (farmer)
- `projects/home/src/app/models/map.models.ts` → `SavedFarm` (land), `LatLngPoint[]` (boundary)
- `projects/home/src/app/models/crop-timeline.models.ts` → `CropEntity` (crop)
- `projects/home/src/app/models/activity.models.ts` → `Activity` (activity)
- `projects/home/src/app/models/weather.models.ts` → `CurrentWeather`, `ForecastDay`, `WeatherAlert` (weather)
- `projects/home/src/app/models/backup.models.ts` → `Activity.attachments[]` (activity_attachment)

### Backend Schemas
- `projects/backend/myfarm_api/schemas/activity.py` → `Activity`, `ActivityCreate`, `ActivityUpdate`

### Storage Keys
- `projects/home/src/app/core/storage/local-storage.service.ts` → `my_farm_${userId}_*` keys
- `projects/home/features/activity/migration.ts` → Legacy key handling

## Current State (Testing Phase)

- **Backend:** Firebase Firestore (no Postgres)
- **Frontend:** localStorage with in-memory sync
- **Migration:** Not yet needed; no real user data

Real migration will occur when:
1. Production users exist with data in localStorage
2. Firebase backend is fully deployed and tested
3. A feature flag or explicit user action triggers the migration

## Future: Postgres Migration Path

When Postgres is adopted:

1. **Backend:** Use `migrations/0001_init.sql` + `0002_rbac.sql` to bootstrap schema
2. **Firestore → Postgres sync:** Use `MIGRATION_MAP.md` logic to bulk-insert
3. **Dual-write phase:** Write to both Firestore and Postgres during transition
4. **Cutover:** Validate data integrity, switch read queries to Postgres, deprecate Firestore
5. **Schema updates:** Always update `schema.ts` first, then regenerate both SQL and Firestore docs

## Existing Schema Documentation

For reference, an older ER diagram exists at `.diagram/er.md` (Mermaid).
This `db/` directory supersedes it as the verified, detailed schema source.
The diagram is not kept in sync; this directory is the source of truth.

## Contributing

When modifying the schema:

1. **Update `schema.ts` first** — make it the source of truth
2. **Verify against real models** — check the source file references
3. **Update Postgres SQL** — regenerate migration files to match schema
4. **Update Firestore docs** — update `firestore/structure.md` and indexes
5. **Update migration map** — if field names or types change, update `MIGRATION_MAP.md`
6. **Test in both environments:**
   - Postgres: Syntax validation, FK integrity
   - Firestore: Run sample queries, verify indexes
7. **Commit as a group** — schema changes should touch all related files atomically

## Questions?

- **Why separate Postgres docs if we're Firebase-only now?**
  → Future-proofing. If the app scales to Postgres, this schema is your starting point.
  Avoids rework when migration is decided; keeps options open.

- **Why denormalize in Firestore (e.g., farmer_id everywhere)?**
  → Firestore lacks implicit collection scoping in queries. Denormalization simplifies common queries
  (e.g., "get all activities for farmer_id = X"). When migrating to Postgres, these denorm fields are dropped.

- **What about activity_attachment? Is it used?**
  → Currently, attachments are base64 strings in `activity.attachments[]` array.
  Formalizing them as separate documents ensures Firestore doc size stays under 1MB,
  following best practices. The field exists in schema for completeness.

- **Is RBAC implemented?**
  → No. `user_role` is currently free text. RBAC schema is defined in `0002_rbac.sql`
  and `schema.ts` for reference; apply only when your app needs role-based access control.
