# My Farm - Demo Script

This script walks through the key features of the My Farm agricultural management platform. Use this for demos, user training, and testing critical user flows.

**Estimated Time:** 15-20 minutes  
**Prerequisite:** App loaded at `http://localhost:4200` or production URL

---

## 1. Onboarding & Authentication (2 min)

### Initial State
- App shows login page if not authenticated
- Demo data mode available for quick testing

### Steps
1. **Create Account** (or use existing demo account)
   - Click "Register as Farmer" or "Sign Up"
   - Enter farm name: *"Green Valley Farm"*
   - Email: *"farmer@example.com"*
   - Password: *"demo123"*
   - Click "Register"

2. **View Onboarding Checklist**
   - Post-signup, user sees onboarding checklist
   - Status shows: Set Location, Add Land, Create Crop, Log Activity, View Reports
   - Uncompleted items have yellow warning badges

---

## 2. Lands Module - Map & Field Mapping (3 min)

### Navigate to Lands Tab
- Click **Lands** in sidebar or footer
- Map view loads with draw tools

### Add a Saved Farm (Draw Land)
1. Click **"Start Drawing"** button
2. Click on map 3+ times to create polygon (e.g., rectangular field)
3. Click **"Finish"** to calculate area
   - Shows hectares and acres
4. Enter land name: *"North Field"*
5. Click **"Save"** → Toast confirmation
6. New land appears in **"My Saved Farms"** panel with area label

### View Land Details
1. Click saved farm card in left panel
2. Side panel opens showing:
   - Land name and coordinates
   - Calculated area (hectares/acres)
   - **Associated Crops** section (empty initially)
3. Click farm on map → same panel appears

### Manage Lands
1. Hover over saved farm → delete icon appears
2. Click delete → confirmation dialog
3. ✅ Can only delete lands with no active crops

---

## 3. Weather Dashboard (2 min)

### Navigate to Weather Tab
- Click **Weather** in sidebar
- Smart Farming Dashboard loads

### Key Features
1. **Location Display**
   - Shows farm location from lands or profile
   - Resolves priority: Farm centroid → Profile location → Default (Nashik)
   - **Data source badge** shows Live/Cached/Demo status

2. **Current Weather Card**
   - Large temperature display
   - Condition description
   - "Feels like" temperature
   - AI Crop Advisor insight box

3. **Weather Metrics Grid** (4 cards)
   - Temperature
   - Rain Chance (%)
   - Wind Speed (km/h)
   - Humidity (%)

4. **7-Day Forecast**
   - Scrollable forecast cards
   - Day name, date, high temp, condition icon
   - Period navigation (Earlier/Upcoming Horizon)

5. **Soil Condition** (mock data)
   - Moisture percentage with progress bar
   - Soil temperature with progress bar

6. **Crop Advisory**
   - AI-generated farming recommendations
   - Dynamically adjusts based on weather conditions

7. **Historical Weather Trends**
   - Dropdown selector (Weekly/Monthly/Yearly)
   - Trend chart showing historical patterns

8. **Farmer Tip of the Day**
   - Contextual farming advice based on weather

### Data Sources
- **Live** (green badge) — Real OpenWeatherMap API (if configured)
- **Cached** (orange badge) — Previously fetched data (network fallback)
- **Demo** (gray badge) — Mock data (no API key configured)

---

## 4. Crop Timeline Module (5 min)

### Navigate to Crops Tab
- Click **Crops** in sidebar
- Crop dashboard shows list of crops

### Create a New Crop
1. Click **"+ New Crop"** button or **"Add Crop"** modal
2. Fill form:
   - Crop name: *"Tomato"*
   - Land: Select *"North Field"* (from saved lands)
   - Primary crop variety: *"Hybrid F1"*
   - Sowing date: *Today's date*
   - Expected harvest: *90 days from today*
3. Click **"Create"** → Toast success, crop added to list

### View Crop Timeline
1. Click crop card → Detail page opens
2. **Crop Header** shows:
   - Crop name + timeline title
   - Days After Sowing (DAS) counter
   - Total cost (aggregated from activities)
   - Delete button

3. **Crop Lifecycle Progress** stepper shows:
   - All stages: Land Preparation → Sowing → Vegetative → Flowering → Fruiting → Maturity → Harvest
   - Current stage highlighted
   - Completed stages show checkmark
   - Click any stage to log activity for that stage

4. **Activities Summary** section lists:
   - All activities logged for this crop
   - Status badges (Draft/Scheduled/In Progress/Completed)
   - Cost for each activity
   - Edit/Delete/Mark Complete buttons

### Log an Activity
1. Click **"Log Activity"** (top button) or **"+ Add"** in activities
2. Activity modal opens
3. Fill form:
   - Activity type: Select *"Sowing"* (dropdown with emoji)
   - Date: Select date
   - Description: *"Scattered seeds evenly in prepared soil"*
   - Cost: *500* (rupees)
   - Category: *"Seeds & Inputs"*
   - Images: (optional) click to upload
4. Click **"Submit"** → Toast success, activity added
5. See activity appear in timeline with cost

### Edit Activity
1. Click **Edit** on any activity
2. Modal reopens with pre-filled data
3. Modify and click **"Save"** → Updates instantly

### Mark Activity Complete
1. Click **"✓ Mark Complete"** on any activity
2. Status changes to "Completed" with checkmark icon

---

## 5. Activities Module (2 min)

### Navigate to Activities Tab
- Click **Activities** in sidebar
- Full list of all activities across all crops
- Filters by status, crop, date range

### Features
1. **Activity Cards** show:
   - Activity type with emoji icon
   - Date and time
   - Associated crop name
   - Status badge with color
   - Cost amount
   - Action buttons (Edit, Delete, Mark Complete)

2. **Bulk Actions**
   - Filter by status (All/Draft/Scheduled/In Progress/Completed)
   - Search by crop or description
   - Sort by date or cost

3. **Activity Detail**
   - Click activity → expands or opens detail view
   - Shows full description, images, cost breakdown

---

## 6. Reports Module (2 min)

### Navigate to Reports Tab
- Click **Reports** in sidebar
- Report generation interface

### Generate Season Report
1. Select **Season**: *"Kharif"* (dropdown)
2. Select **Year**: *Current year*
3. Click **"Generate Report"** button
4. Report appears with 4 sections:

#### Report Summary Card
- Total Season Expenses (₹)
- Number of Crops
- Total Expense Line Items

#### Expenses by Category Table
- Category name (Seeds, Fertilizer, etc.)
- Total amount (₹)
- Count of transactions
- % of total expenses
- Useful for identifying high-cost areas

#### Expenses by Crop Table
- Crop name
- Total cost for season (₹)
- Number of activities
- Cost per activity (₹)
- Shows which crops are most expensive

#### Expenses by Month Table
- Month name
- Total expenses (₹)
- Visualizes spending over time

### Export Report
1. Click **"Export CSV"** button (appears after report generates)
2. CSV file downloads with all data
3. Open in Excel/Sheets for further analysis

---

## 7. User Profile & Settings (1 min)

### Navigate to Profile
- Click **Profile** icon (user avatar in header) or sidebar
- Profile page shows user details

### Profile Information
1. **Farm Details**
   - Farm name
   - Farmer name
   - Email address

2. **Location Information**
   - Village name
   - State/Region
   - Set location button (for weather personalization)

3. **Settings Options**
   - Primary crops (multi-select)
   - Backup/Restore farm data
   - Clear demo data option

### Backup & Restore
1. Click **"Backup Farm Data"** → JSON file downloads
   - Contains all crops, lands, activities, expenses
   - Named with timestamp

2. Click **"Restore from Backup"** → file picker
   - Select previously downloaded backup JSON
   - Restore data to current account

---

## 8. Data & Metadata (1 min)

### Version & Build Information
- Footer displays app version (e.g., "0.1.0")
- Build stamp shows deployment date/commit

### Demo Data Reset
1. Go to **Profile → Settings**
2. Click **"Clear Demo Data"** button
3. Confirms action → All demo data deleted
4. App resets to fresh state

---

## 9. Progressive Profiling (During Usage)

### Location Prompt
- If user hasn't set location, yellow banner appears in weather dashboard
- Prompts to "Configure Location" for better accuracy
- Links to profile settings

### Onboarding Checklist
- Visible on dashboard and profile
- Checks off items as user completes flows
- Motivates user to try core features

---

## 10. Accessibility & Responsiveness

### Mobile Experience
- All tabs accessible via mobile-friendly sidebar
- Sticky header with navigation
- FAB buttons for quick actions (Log Activity, Back)
- Touch-friendly button sizes

### Desktop Experience
- Full sidebar with all navigation
- Multi-column layouts where space allows
- Hover tooltips on UI elements

---

## Common Demo Flows

### Quick Start (5 min)
1. Login/Register
2. Draw a land field
3. Create a crop
4. Log an activity (Sowing)
5. View crop timeline with cost

### Full Feature Tour (20 min)
1. Follow entire script above
2. Emphasize weather location resolution
3. Show report generation from multiple crops
4. Demonstrate backup/restore capability

### Cost Tracking Focus (10 min)
1. Create crop
2. Log 3-4 activities with different costs
3. Generate report
4. Export CSV
5. Show cost breakdown by category and crop

---

## Troubleshooting During Demo

| Issue | Solution |
|-------|----------|
| Map not loading | Ensure browser allows geolocation; try different browser |
| Weather shows "Demo" | API key not configured (expected in dev); explain Live/Demo sources |
| Activities not appearing | Refresh page; check crop-activity association |
| CSV export fails | Check browser security settings for file downloads |
| Slow performance | Large number of activities; demo with 10-15 activities instead |

---

## Key Talking Points

### Problem Solved
- *"Farmers waste time tracking crops in notebooks or Excel. My Farm centralizes everything."*

### Key Features
- **Smart Timeline** — Visual crop lifecycle with stages
- **Real-time Weather** — API-driven local forecasts
- **Cost Tracking** — Never lose track of expenses
- **Map-Based Lands** — Know exactly which crops are where
- **Offline-Ready** — PWA works without network

### Technical Highlights
- **Modern Angular** — Standalone components, signals, latest framework features
- **Responsive Design** — Works on phone, tablet, desktop
- **Progressive Web App** — Installable as app, works offline
- **Smart Caching** — Weather data cached, minimal API calls

---

## Demo Tips

✅ **Do:**
- Start fresh (use demo reset if needed)
- Take your time explaining each section
- Click through multiple crops/activities
- Show mobile view on phone if possible
- Ask questions: "What would help your farm management?"

❌ **Don't:**
- Assume user understands agricultural terminology
- Skip the map interaction (it's visually impressive)
- Spend too long on one section
- Use real farm data (sensitive information)

---

## Next Steps for User

After demo, guide toward:
1. **Setup** — Add real lands and crops
2. **Monitoring** — Log daily activities
3. **Analysis** — Review monthly reports
4. **Optimization** — Use insights to reduce costs

