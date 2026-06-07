# Implementation Plan - Farm Activity Module (MVP)

Introduce a new Farm Activity Module to allow farmers to record work performed on the farm, track progress, manage expenses per activity, and view expense reports on a dashboard.

## User Review Required

> [!IMPORTANT]
> **Data Integration**:
> We will integrate with:
> 1. `CropTimelineService` to fetch existing crops, so farmers can link an activity to an active crop.
> 2. `FarmDrawService` to fetch saved farm layouts (drawn fields) so farmers can link an activity to a field.
>
> **Aesthetic Enhancements**:
> - A premium dashboard with KPI cards and customized, interactive SVG-based charts (Expense by Activity, Expense by Category, Monthly Trend) using Outfit typography and CSS transitions.
> - Responsive layouts for mobile and desktop viewports, following the agricultural HSL green and soil palettes.

## Open Questions

None at this stage. The requirements document is highly detailed and fits perfectly into the existing Angular standalone component architecture.

---

## Proposed Changes

We will organize the code under the `features/farm-activity` folder in the main application project.

### 1. Data Models & Constants

#### [NEW] [farm-activity.models.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/farm-activity.models.ts)
Define structural types:
- `ActivityStatus`: `'Draft' | 'In Progress' | 'Completed'`
- `Activity`:
  - `id`: string
  - `date`: string (ISO or YYYY-MM-DD)
  - `season`: string (e.g. `'Kharif' | 'Rabi' | 'Summer'`)
  - `activityId`: string (Name/type of work: e.g. "Bore Installation", "Sowing", etc.)
  - `cropId`: string (Optional reference to CropEntity)
  - `fieldId`: string (Optional reference to SavedFarm)
  - `status`: ActivityStatus
  - `notes`: string (Optional)
  - `createdAt`: number
  - `updatedAt`: number
- `ActivityExpense`:
  - `id`: string
  - `activityId`: string (foreign key)
  - `category`: string (Required, e.g. "Machine Rent", "Workers", "Transport")
  - `itemId`: string (Optional)
  - `resourceId`: string (Optional)
  - `quantity`: number (Optional)
  - `unit`: string (Optional)
  - `rate`: number (Optional)
  - `amount`: number (Required)
  - `remarks`: string (Optional)
  - `createdAt`: number

---

### 2. State & Storage Service

#### [NEW] [farm-activity.service.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/farm-activity.service.ts)
Create an Angular `@Injectable({ providedIn: 'root' })` service using Angular signals:
- Signals:
  - `activitiesSignal = signal<Activity[]>([])`
  - `expensesSignal = signal<ActivityExpense[]>([])`
- Methods:
  - `addActivity(activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Activity`
  - `updateActivity(id: string, updates: Partial<Activity>): void`
  - `deleteActivity(id: string): void`
  - `addExpense(expense: Omit<ActivityExpense, 'id' | 'createdAt'>): ActivityExpense`
  - `deleteExpense(id: string): void`
  - `getExpensesForActivity(activityId: string): ActivityExpense[]`
  - `getTotalExpenseForActivity(activityId: string): number`
- Load/Save functionality using local storage keys `my_farm_activities` and `my_farm_activity_expenses`.
- Seed initial mock data (like the Bore Installation activity from 10 Jun 2026 with machine rent, workers, and transport expenses totaling ₹21,950).

---

### 3. Component Shell & Routing

#### [NEW] [farm-activity.component.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/farm-activity.component.ts)
Standalone router shell containing `<router-outlet></router-outlet>`.

#### [MODIFY] [app.routes.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/app.routes.ts)
Register routing under `/activities` pointing to:
- `''` -> Dashboard view
- `'list'` -> Activity List view
- `'create'` -> Create Activity view
- `':id'` -> Detail / Edit view

#### [MODIFY] [sidebar.html](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/layout/sidebar/sidebar.html)
Add a navigation link for Activities:
```html
<a class="nav-link" routerLink="/activities" routerLinkActive="active" (click)="onNavClick()">
  <i class="bi bi-activity me-2"></i>Activities
</a>
```

---

### 4. UI Screens

#### [NEW] [activity-dashboard.component.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/dashboard/activity-dashboard.component.ts)
#### [NEW] [activity-dashboard.component.html](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/dashboard/activity-dashboard.component.html)
#### [NEW] [activity-dashboard.component.scss](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/dashboard/activity-dashboard.component.scss)
- KPI Cards: Total Activities, Total Expense, Completed, In Progress.
- Premium Responsive SVG Analytics Charts:
  - **Expense by Activity**: Horizontal bar layout comparing total expenses of different activities.
  - **Expense by Category**: Donut chart (SVG circular track) with category indicators and hover states.
  - **Monthly Trend**: SVG path area line chart showing monthly expense sums.

#### [NEW] [activity-list.component.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/list/activity-list.component.ts)
#### [NEW] [activity-list.component.html](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/list/activity-list.component.html)
#### [NEW] [activity-list.component.scss](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/list/activity-list.component.scss)
- Search & Filter Controls:
  - Season (Kharif, Rabi, Summer, All)
  - Crop (populated from `CropTimelineService` & typed entries, All)
  - Field (populated from `FarmDrawService` & typed entries, All)
  - Activity Type (Bore Installation, Sowing, Fertilizing, Spraying, Harvest, etc., All)
  - Status (Draft, In Progress, Completed, All)
- Sorting:
  - Latest First (Default)
  - Highest Cost
  - Oldest First
- Grid of Cards representing activities: showing title, date, cost, status badge, field, crop, and hover transitions.

#### [NEW] [create-activity.component.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/create/create-activity.component.ts)
#### [NEW] [create-activity.component.html](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/create/create-activity.component.html)
#### [NEW] [create-activity.component.scss](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/create/create-activity.component.scss)
- Quick creation form (takes less than 30s):
  - Date (Default to today)
  - Season (Select)
  - Activity Name (e.g. text or common suggestions dropdown)
  - Crop (Select from list, optional)
  - Field (Select from saved farm areas, optional)
  - Status (Default: In Progress)
  - Notes (textarea)
- Validations (Required fields: Date, Season, Activity Name, Status)

#### [NEW] [activity-detail.component.ts](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/detail/activity-detail.component.ts)
#### [NEW] [activity-detail.component.html](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/detail/activity-detail.component.html)
#### [NEW] [activity-detail.component.scss](file:///c:/Users/Ram/dev/fe/my-farm/projects/home/src/app/features/farm-activity/detail/activity-detail.component.scss)
- Activity Header Information panel.
- Status quick-toggle selector.
- Notes text box edit capability.
- **Expenses Section**:
  - Displays list of expense entries with custom cards showing Category, Item/Resource (if provided), Qty, Rate, Amount, Remarks.
  - Form to add a new expense:
    - Fields: Category (Select / Custom), Item, Resource, Quantity, Unit, Rate, Amount, Remarks.
    - Automatic calculation: updating `Amount = Quantity * Rate` on rate or quantity changes.
    - Add button to append the expense in <60 seconds.
  - Delete action per expense item.

---

## Verification Plan

### Automated Tests
Run Angular specs to ensure code compiles and tests pass:
- `npm run test` or direct execution of `ng test` to verify logic correctness.

### Manual Verification
1. Launch `npm run dev` to start the local development server.
2. Navigate to `http://localhost:4200/activities`.
3. Check the **Dashboard** and verify KPI counts and custom charts are rendered.
4. Go to **Activities List** and filter by Status, Crop, Field, and Season. Sort by Cost.
5. Create a new activity using the **+ New Activity** form in <30 seconds.
6. Open the newly created activity and add details (expenses) in <60 seconds.
7. Verify that the **Total Expense** updates instantly and matches the sum of the entries.
8. Complete the activity and check if it reflects on the Dashboard.
