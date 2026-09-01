# Phase 1: Unify Activity Model

**Status**: Not Started  
**Goal**: One source of truth for "a thing a farmer did on a field/crop"

---

## The Problem

Two independent models coexist, solving the same problem:

### Current State

**`crop-timeline.models.ts`** — `ActivityEntity`
```typescript
export interface ActivityEntity {
  id: string;
  parentActivityId?: string;
  cropId: string;                    // REQUIRED
  type: ActivityType;                // Typed enum: Sowing, Irrigation, Fertilizer, Spray, etc.
  date?: number;
  status: ActivityStatus;            // Planned | Scheduled | Completed | Cancelled
  cost: number;                      // in ₹
  notes: string;
  attachments: string[];
  metadata: {
    // Type-specific sub-fields (irrigationMethod, duration, fertilizerName, etc.)
  };
}
```

**`farm-activity.models.ts`** — `Activity` + `ActivityExpense`
```typescript
export interface Activity {
  id: string;
  parentActivityId?: string;
  date?: number;
  season: string;                    // Free text: Kharif, Rabi, etc.
  activityId: string;                // FREE TEXT, e.g. "Bore Installation", "Sowing"
  cropId?: string;                   // OPTIONAL (can exist without crop)
  fieldId?: string;                  // Optional link to SavedFarm
  status: ActivityStatus;            // Draft | In Progress | Completed (different enum!)
  notes?: string;
  attachments?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ActivityExpense {
  id: string;
  activityId: string;
  category: string;                  // Machine Rent, Workers, Transport, etc.
  quantity?: number;
  unit?: string;
  rate?: number;
  amount: number;                    // Explicit expense tracking
  remarks?: string;
  createdAt: number;
}
```

### Problems This Causes

1. **`create-activity.component.ts`** reaches into BOTH services:
   - `CropTimelineService.activities()` (for parent activity dropdown)
   - `FarmActivityService.activities()` (for create/edit)
   - Mixing two models in one screen makes it ambiguous which one is canonical

2. **Expense tracking**: 
   - `ActivityEntity.cost` is a single number
   - `Activity` + `ActivityExpense` model detailed line items
   - No way to convert between them

3. **Status enums differ**:
   - `ActivityEntity`: Planned | Scheduled | Completed | Cancelled
   - `Activity`: Draft | In Progress | Completed
   - Code can't assume either enum matches farmer expectations

4. **Crop linkage is asymmetric**:
   - `ActivityEntity` requires cropId (crops own activities)
   - `Activity` makes cropId optional (activities can exist on fields or standalone)
   - Queries are unclear: "give me activities for crop X" — which service?

5. **Future cross-linking breaks**:
   - Dashboard showing "this crop's timeline and total expenses" can't reliably fetch both
   - Reports on activity spend per crop impossible without custom join logic

---

## The Solution

**One unified model, one service**, sitting at the feature level (neither buried in crop-timeline nor farm-activity).

### New Model: `Activity` (recommended: keep farm-activity's simpler shape, enhance it)

**Location**: `projects/home/src/app/features/activity/activity.models.ts`

```typescript
// Combine crop-timeline's typed ActivityType with farm-activity's flexibility
export type ActivityType =
  | 'Sowing'
  | 'Irrigation'
  | 'Fertilizer Application'
  | 'Spray Application'
  | 'Weeding'
  | 'Field Inspection'
  | 'Labour Activity'
  | 'Harvest'
  | 'Sale'
  | 'Weather Incident'
  | 'Maintenance'
  | 'Custom';  // Allow free text for edge cases

export type ActivityStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Activity {
  id: string;
  parentActivityId?: string;  // Self-reference for sub-activities
  
  // Timing
  date: number;  // timestamp
  season?: string;  // 'Kharif' | 'Rabi' | 'Summer', optional but recommended
  
  // Links (both optional, can exist without either)
  cropId?: string;  // Link to CropEntity if activity is crop-specific
  fieldId?: string;  // Link to SavedFarm if activity is field-specific
  
  // Activity definition
  type: ActivityType;  // Typed, but 'Custom' allows free text
  customActivityName?: string;  // Used when type === 'Custom'
  
  // Execution state
  status: ActivityStatus;
  notes?: string;
  attachments?: string[];  // Base64 images
  
  // Type-specific metadata (crops can set these, but fields are optional)
  metadata?: {
    // Irrigation specific
    irrigationMethod?: string;  // 'Drip' | 'Sprinkler' | 'Flood'
    waterQuantity?: number;  // liters
    duration?: number;  // minutes

    // Fertilizer/Spray specific
    chemicalName?: string;
    quantity?: number;  // kg or liters
    dosage?: string;
    applicationMethod?: string;
    targetPest?: string;

    // Harvest specific
    yieldQuantity?: number;
    yieldUnit?: string;  // kg, quintals, tons
    grade?: string;  // A, B, C
    sellingPrice?: number;  // per unit

    // Generic
    [key: string]: any;
  };

  // Audit
  createdAt: number;
  updatedAt: number;
}

// Expense line items (from farm-activity, unchanged)
export interface ActivityExpense {
  id: string;
  activityId: string;  // FK to Activity.id
  category: string;  // Machine Rent, Labour, Seeds, Fertilizer, Transport, etc.
  itemId?: string;
  resourceId?: string;
  quantity?: number;
  unit?: string;  // hours, days, bags, litres
  rate?: number;
  amount: number;  // Required; calculated as quantity * rate or entered directly
  remarks?: string;
  createdAt: number;
}
```

### Why This Shape

- **Keeps crop-timeline's typed `ActivityType`** (validation, UI dropdowns)
- **Keeps farm-activity's simpler structure** (no metadata pollution for simple activities)
- **Adds optional metadata for power users** (irrigation duration, harvest yield, etc.)
- **Makes both cropId and fieldId optional** (activities can live on fields, crops, or standalone)
- **Preserves expense sub-model** (detailed cost tracking is a real need)
- **Stays backward-compatible with storage** (old crop-timeline subactivities just use `type: 'Custom'` + `customActivityName`)

---

## Implementation Steps

### Step 1: Create new unified service
**File**: `projects/home/src/app/features/activity/activity.service.ts`

- Migrate logic from both `CropTimelineService.activities()` and `FarmActivityService`
- Use signals for reactivity (match existing code style)
- Add methods:
  - `addActivity(data): Activity`
  - `updateActivity(id, updates): void`
  - `deleteActivity(id): void`
  - `addExpense(activityId, expense): ActivityExpense`
  - `updateExpense(id, updates): void`
  - `deleteExpense(id): void`
  - `getActivitiesForCrop(cropId): Activity[]`
  - `getActivitiesForField(fieldId): Activity[]`
  - `getExpensesForActivity(activityId): ActivityExpense[]`
  - `getTotalExpenseForActivity(activityId): number`
- Storage: `localStorage` keys `my_farm_activities` + `my_farm_activity_expenses`
- **No behavior change yet** — just expose both old and new APIs during transition

### Step 2: Create migration script
**File**: `projects/home/src/app/features/activity/migration.ts`

When the app first loads, detect old data:
```typescript
export function migrateActivityData(): void {
  const oldCropTimeline = localStorage.getItem('my_farm_crop_timeline');
  const oldFarmActivity = localStorage.getItem('my_farm_activities_old');
  
  if (oldCropTimeline) {
    // Parse old ActivityEntity records
    // Convert to unified Activity shape
    // Store under new key
    // Mark as migrated (so we don't run twice)
  }
  
  if (oldFarmActivity) {
    // Already in correct-ish shape, just validate and store
  }
}
```

Call this in `AppComponent` constructor or route guard before any feature loads.

### Step 3: Migrate crop-timeline to use unified model
**Files to change**:
- `projects/home/src/app/features/crop-timeline/crop-timeline.service.ts`
  - Replace internal `activities: signal<ActivityEntity[]>` with call to new `ActivityService`
  - Keep existing public API (crops, etc.) unchanged
  - Remove activity CRUD logic → delegate to `ActivityService`

- `projects/home/src/app/features/crop-timeline/add-crop/add-crop.component.ts`
  - Inject `ActivityService` instead of directly reading `CropTimelineService.activities()`

- **Delete** `crop-timeline.models.ts#ActivityEntity` (no longer needed)

### Step 4: Migrate farm-activity to use unified model
**Files to change**:
- `projects/home/src/app/features/farm-activity/farm-activity.service.ts`
  - Becomes a thin wrapper/re-export of `ActivityService`
  - Deprecate (keep for backward compat one release, then remove)

- All farm-activity components already import from `FarmActivityService`
  - No changes needed if we keep the thin wrapper
  - Gradually replace `FarmActivityService` imports with direct `ActivityService` imports

### Step 5: Update create-activity component
**File**: `projects/home/src/app/features/farm-activity/create/create-activity.component.ts`

Currently:
```typescript
readonly crops = this.cropService.crops;
readonly savedFarms = this.farmDrawService.savedFarms;
readonly availableParentActivities = computed(() => {
  // Reaches into cropService.activities()
  return this.cropService.activities().filter(...)
});
```

After:
```typescript
readonly crops = this.cropService.crops;
readonly savedFarms = this.farmDrawService.savedFarms;
readonly availableParentActivities = computed(() => {
  // Single source: ActivityService
  return this.activityService.activities().filter(a => a.parentActivityId === undefined);
});
```

No template changes needed (form structure stays the same).

### Step 6: Add type-safe dropdowns for ActivityType
**File**: `projects/home/src/app/features/activity/activity.constants.ts`

```typescript
export const ACTIVITY_TYPES: Record<ActivityType, string> = {
  'Sowing': 'Sowing',
  'Irrigation': 'Irrigation',
  'Fertilizer Application': 'Fertilizer Application',
  // ... etc
  'Custom': 'Other (custom)',
};

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES).map(
  ([key, label]) => ({ value: key, label })
);
```

Use in form `<select>` instead of free-text `activityId` field.

### Step 7: Update dashboards
**`ActivityDashboard`** and **`CropDashboard`** now both call `ActivityService`:

```typescript
// Activity Dashboard: all activities
readonly activities = this.activityService.activities;

// Crop Dashboard: filter to this crop
readonly cropActivities = computed(() => {
  const cropId = this.selectedCropId();
  return this.activityService.getActivitiesForCrop(cropId);
});
```

Both render the same unified data → easier to cross-link.

### Step 8: Testing
- **Unit tests**: Update `activity.service.spec.ts` to test CRUD + queries
- **Migration tests**: Verify old data converts correctly
- **E2E**: Create activity in crop-timeline, verify it appears in farm-activity dashboard (and vice versa)

---

## Storage & Backward Compatibility

### During Transition
- Old keys stay in localStorage (migration preserves them)
- New `ActivityService` reads from new keys only
- If user hasn't migrated, old data is invisible (one-way migration)

### After Merge
- Old keys can be cleaned up (one release later)
- All new activity creation goes to unified model

### No API Breaking Change
- `CropTimelineService.activities()` still works (returns filtered unified activities)
- `FarmActivityService` still works (thin wrapper)
- Old components keep working without edits

---

## Success Criteria

✅ All tests pass  
✅ `npm run lint` succeeds  
✅ `npm run format:check` succeeds  
✅ Crop timeline dashboard shows crops and their linked activities  
✅ Farm activity dashboard shows all activities, filterable by crop/field/status  
✅ Create activity (from either dashboard) appears in both dashboards  
✅ Expenses sum correctly on activity detail screen  
✅ Old localStorage data migrates silently on first load  

---

## Files Summary

### New Files
- `projects/home/src/app/features/activity/activity.models.ts` — unified models
- `projects/home/src/app/features/activity/activity.service.ts` — central service
- `projects/home/src/app/features/activity/activity.constants.ts` — enums & labels
- `projects/home/src/app/features/activity/migration.ts` — data migration
- `projects/home/src/app/features/activity/activity.service.spec.ts` — tests

### Files to Modify
- `projects/home/src/app/features/crop-timeline/crop-timeline.service.ts` — delegate to ActivityService
- `projects/home/src/app/features/crop-timeline/add-crop/add-crop.component.ts` — use ActivityService
- `projects/home/src/app/features/farm-activity/create/create-activity.component.ts` — use ActivityService
- `projects/home/src/app/features/farm-activity/farm-activity.service.ts` — make thin wrapper
- Dashboard components (crop-dashboard, activity-dashboard) — cross-link activities

### Files to Delete
- `projects/home/src/app/features/crop-timeline/crop-timeline.models.ts` (ActivityEntity removed)

---

## Estimated Effort

- **Research & setup**: 30 min
- **New service + models**: 1 hour
- **Migration script**: 30 min
- **Refactor crop-timeline**: 1 hour
- **Refactor farm-activity**: 30 min
- **Update dashboards**: 1 hour
- **Testing & fixes**: 1–2 hours

**Total**: ~5–6 hours of work, ~1 PR

---

## Open Questions

- Should we keep `crop-timeline.service.ts#activities()` or switch all code to `ActivityService`?
  - **Recommendation**: Switch gradually. First PR unifies the model, second PR removes the old API.
- How aggressive on TypeScript strictness? (`ActivityType` enum vs. free text for custom)
  - **Recommendation**: Enum + 'Custom' string (type safety + flexibility).
