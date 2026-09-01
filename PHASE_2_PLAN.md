# Phase 2: Persistence Abstraction Layer

## Overview
Decouple data persistence from business logic by introducing a `StorageService` abstraction layer. This allows swapping localStorage with real backend APIs in later phases without changing service layer code.

## Current State (Phase 1)
- Activities & Expenses directly use localStorage in ActivityService
- Hard-coded storage keys: `my_farm_activities`, `my_farm_activity_expenses`
- Tightly coupled to browser storage

## Phase 2 Goals

### Goal 1: StorageService Interface
Create an abstraction that services depend on instead of localStorage directly.

```typescript
export interface IStorageService {
  // Get
  getActivities(userId: string): Promise<Activity[]>;
  getExpenses(userId: string): Promise<ActivityExpense[]>;
  
  // Create
  saveActivity(userId: string, activity: Activity): Promise<Activity>;
  saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense>;
  
  // Update
  updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void>;
  updateExpense(userId: string, id: string, updates: Partial<ActivityExpense>): Promise<void>;
  
  // Delete
  deleteActivity(userId: string, id: string): Promise<void>;
  deleteExpense(userId: string, id: string): Promise<void>;
  
  // Sync
  syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]>;
  syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]>;
}
```

### Goal 2: LocalStorageService Implementation
Implement the interface using browser localStorage (replace current direct usage).

```typescript
@Injectable({ providedIn: 'root' })
export class LocalStorageService implements IStorageService {
  constructor(private auth: AuthService) {}
  
  async getActivities(userId: string): Promise<Activity[]> {
    const key = `my_farm_${userId}_activities`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }
  
  // ... other methods
}
```

### Goal 3: Update ActivityService
- Inject IStorageService instead of using localStorage directly
- Convert methods to async/Promise-based (prepare for backend)
- Keep signal-based API for components (use `from()` to wrap Promises)

**Before (Direct localStorage):**
```typescript
this.activities.set([...current, activity]);
localStorage.setItem(key, JSON.stringify(activities));
```

**After (Via StorageService):**
```typescript
const saved = await this.storage.saveActivity(userId, activity);
this.activities.update(current => [...current, saved]);
```

### Goal 4: Update Components
- No changes needed in components (signals remain reactive)
- Just ActivityService changes are sufficient
- Components work with signals as before

### Goal 5: Tests
- Unit tests for LocalStorageService
- Unit tests for AsyncActivityService wrapper
- Mock storage for component tests

## Implementation Steps

### Step 1: Create Storage Interfaces
```
projects/home/src/app/core/storage/
├── storage.interface.ts      (IStorageService)
├── local-storage.service.ts  (LocalStorageService impl)
└── storage.service.spec.ts
```

### Step 2: Update ActivityService
- Inject IStorageService
- Convert to async methods
- Wrap with signals for reactivity

### Step 3: Update AuthService
- Pass userId to storage service methods
- Handle logout (clear user data)

### Step 4: Create AsyncActivityService Wrapper
- Converts Promise-based methods back to signals
- Maintains current component API
- Uses `effect()` to sync async operations

### Step 5: Tests & Verify
- All unit tests passing
- Build & lint clean
- Component functionality unchanged

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| activity.service.ts | Inject IStorageService, make async | High |
| auth.service.ts | Pass userId to storage methods | Medium |
| storage/storage.interface.ts | NEW - Define interface | N/A |
| storage/local-storage.service.ts | NEW - Implement localStorage | N/A |
| storage/storage.service.spec.ts | NEW - Tests | N/A |
| CLAUDE.md | Update completion status | N/A |

## Success Criteria

✅ IStorageService interface defined
✅ LocalStorageService implementation complete
✅ ActivityService refactored to use storage service
✅ All unit tests passing
✅ npm run build passes
✅ npm run lint passes
✅ No component changes required
✅ Functionality identical to Phase 1
✅ Ready for Phase 3 (backend swap)

## Phase 3 Preview (Not in Phase 2)

Once this abstraction is in place, Phase 3 can implement:
```typescript
@Injectable({ providedIn: 'root' })
export class BackendStorageService implements IStorageService {
  constructor(private http: HttpClient) {}
  
  async getActivities(userId: string): Promise<Activity[]> {
    return this.http.get<Activity[]>(`/api/users/${userId}/activities`).toPromise();
  }
  
  // ... other methods using HTTP
}
```

Then just swap:
```typescript
// Current: localStorage
{ provide: IStorageService, useClass: LocalStorageService }

// Phase 3: Backend API
{ provide: IStorageService, useClass: BackendStorageService }
```

## Estimated Effort

- Storage interface design: 1-2 hours
- LocalStorageService implementation: 2-3 hours
- ActivityService refactoring: 3-4 hours
- Tests & verification: 2-3 hours
- **Total: ~8-12 hours**

## Timeline
- **Start**: After Phase 1 PR merged & deleted
- **Duration**: 1 day focused development
- **Delivery**: Complete, testable feature
- **Outcome**: Mergeable branch ready for deletion after merge

---

**Next Phase After 2**: Phase 3 - Real Authentication System
