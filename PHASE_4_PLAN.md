# Phase 4: Real Weather API Integration — Implementation Plan

**Status:** Approved for Implementation  
**Model:** Claude Haiku 4.5  
**Branch:** `claude/phase-4-weather-api`  
**Estimated Effort:** 23 hours  
**Date:** 2026-09-01

---

## Executive Summary

Phase 4 will integrate real-time weather data from OpenWeatherMap API into the farm management application, replacing hardcoded weather values with live data. The implementation maintains architectural consistency with Phases 1-3 (abstract service interfaces, signal-based state, dependency injection) while establishing patterns for Phase 5 backend migration.

---

## Strategic Decisions

### API Selection: OpenWeatherMap
- **Rationale:** Free tier covers current weather, 5-day forecast, alerts; excellent India coverage; industry-standard reliability
- **Endpoints:** Current weather, 5-day forecast, weather alerts
- **Rate Limits:** 1,000 calls/day (sufficient for user base with caching)

### Architecture Pattern
Follows Phase 2's storage abstraction:
- **Abstract Interface:** `IWeatherService` (contract)
- **HTTP Implementation:** `WeatherService` (OpenWeatherMap integration)
- **Cache Layer:** `WeatherCacheService` (30-min TTL, stale-while-revalidate)
- **Benefit:** Phase 5 backend swap requires only DI binding change

### Data Handling Strategy
- **Real Data:** Weather metrics from API (temp, condition, humidity, wind, rain, UV, etc.)
- **Computed Data:** Advisories dynamically generated from weather patterns
- **Dummy Data:** Soil metrics with clear placeholders (awaiting IoT sensors Phase 5+)
- **UI Indicators:** Mark data source (Live API / Placeholder)

---

## Implementation Steps

### Step 1: Create Models & Interfaces (2 hours)
**Files:**
- `projects/home/src/app/core/weather/weather.models.ts` — Data structure definitions
- `projects/home/src/app/core/weather/weather.interface.ts` — Abstract service contract

**Interfaces to define:**
```typescript
// Core weather data
export interface CurrentWeather {
  temp: number; feelsLike: number; condition: string;
  humidity: number; windSpeed: number; rainProbability: number;
  rainfall?: number; uvIndex?: number; visibility?: number;
  fetchedAt: number;
}

export interface ForecastDay {
  date: number; dayName: string; dateLabel: string;
  tempMax: number; tempMin: number; condition: string;
  rainProbability: number; uvIndex?: number;
}

export interface FiveDayForecast {
  days: ForecastDay[]; fetchedAt: number;
}

export interface WeatherData {
  location: WeatherLocation; current: CurrentWeather;
  forecast: FiveDayForecast; alerts?: WeatherAlert[];
  lastRefreshed: number; isStale: boolean;
}

export interface WeatherAlert {
  type: 'frost' | 'hail' | 'heavy_rain' | 'strong_wind' | 'dust' | 'other';
  severity: 'low' | 'medium' | 'high';
  title: string; description: string;
  effectiveAt: number; expiresAt: number;
}

export interface WeatherLocation {
  lat: number; lng: number;
  name?: string; state?: string;
}

export interface WeatherError {
  code: 'NETWORK_ERROR' | 'API_ERROR' | 'INVALID_LOCATION' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string; statusCode?: number; timestamp: number;
}
```

**Abstract Interface:**
```typescript
export abstract class IWeatherService {
  abstract getWeatherData(location: WeatherLocation): Promise<WeatherData>;
  abstract refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather>;
  abstract getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]>;
  abstract clearCache(): void;
  abstract getCachedWeather(): WeatherData | null;
}
```

**Success:** TypeScript strict mode passes, no lint errors

---

### Step 2: Create API Configuration (30 minutes)
**File:** `projects/home/src/app/core/config/api.config.ts`

**Content:**
```typescript
export const API_CONFIG = {
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    endpoints: {
      current: '/weather',
      forecast: '/forecast',
      alerts: '/weather/alerts',
    },
    apiKey: '', // Will be set from environment
  },
};
```

**Success:** No linting errors

---

### Step 3: Create Cache Service (2 hours)
**Files:**
- `projects/home/src/app/core/weather/weather-cache.service.ts`
- `projects/home/src/app/core/weather/weather-cache.service.spec.ts`

**Key Methods:**
- `set(location, data)` — Store weather data
- `get(location)` — Retrieve cached data
- `isFresh(location)` — Check if within TTL (30 min)
- `isStale(location)` — Check if within max age (2 hours)
- `clear()` — Clear all cache

**Test Cases:**
- Cache hit/miss behavior
- TTL expiration handling
- Stale data flagging
- Multiple location caching
- Cache clear functionality

**Success:** `npm run test` passes, >85% coverage

---

### Step 4: Create HTTP Weather Service (3-4 hours)
**Files:**
- `projects/home/src/app/core/weather/weather.service.ts`
- `projects/home/src/app/core/weather/weather.service.spec.ts`

**Implementation:**
- Extend `IWeatherService`
- Inject `HttpClient`, `WeatherCacheService`, `AuthService`
- API methods with error handling (4-tier fallback)
- Response transformation to typed models
- Cache integration with revalidation

**Methods:**
```typescript
getWeatherData(location: WeatherLocation): Promise<WeatherData>
  // Fetch both current + forecast, cache result

refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather>
  // Quick update of current conditions

getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]>
  // Fetch severe weather alerts

clearCache(): void
  // Invalidate cache on location change
```

**Error Handling (4-tier fallback):**
1. Real API data (success)
2. Cached data (network/API error)
3. Mock sensible defaults (severe error)
4. User error message (complete failure)

**Test Coverage (HttpTestingController):**
- Successful API responses + transformation
- Network errors → fallback to cache
- API errors (401, 429, 5xx) → fallback handling
- Cache behavior with mocked HTTP
- Location validation

**Success:** `npm run test` passes (100% coverage), `npm run lint` passes

---

### Step 5: Update DI Configuration (30 minutes)
**File:** `projects/home/src/app/app.config.ts`

**Addition:**
```typescript
providers: [
  // ... existing providers
  { provide: IWeatherService, useClass: WeatherService },
]
```

**Success:** `npm run build` passes without errors

---

### Step 6: Update Weather Component (2-3 hours)
**Files:**
- `projects/home/src/app/features/weather/weather.component.ts`
- `projects/home/src/app/features/weather/weather.component.spec.ts`

**Changes:**
- Replace hardcoded signals with service-backed signals
- Inject `IWeatherService`
- Load weather on user location change
- Create advisory signal computed from weather data
- Create alert banner signal

**Signals to update:**
```typescript
readonly weatherData = computed(() => {
  this.authService.currentUser(); // Trigger on user change
  return this.weatherService.currentWeather();
});

readonly currentTemp = computed(() => this.weatherData()?.current.temp ?? 28);
readonly currentCondition = computed(() => this.weatherData()?.current.condition ?? 'Partly Cloudy');
readonly feelsLike = computed(() => this.weatherData()?.current.feelsLike ?? 28);
readonly sunriseTime = computed(() => formatTime(this.weatherData()?.current.sunrise));
readonly sunsetTime = computed(() => formatTime(this.weatherData()?.current.sunset));

readonly forecast = computed(() => this.weatherData()?.forecast.days ?? []);

readonly weatherAdvisory = computed(() => {
  const weather = this.weatherData();
  const user = this.authService.currentUser();
  return this.generateAdvisory(weather, user?.primaryCrops || []);
});

readonly urgentAlerts = computed(() => {
  const alerts = this.weatherData()?.alerts || [];
  return alerts.filter(a => a.severity === 'high');
});

readonly showAlertBanner = computed(() => this.urgentAlerts().length > 0);
```

**Advisory Generation Logic:**
```typescript
private generateAdvisory(weather: WeatherData, crops: string[]): string[] {
  const advisory: string[] = [];
  
  if (weather.current.rainProbability > 70) {
    advisory.push('High rain expected — delay pesticide spraying');
    advisory.push('Good time for irrigation (rain will reduce water need)');
  }
  
  if (weather.current.temp > 35) {
    advisory.push('High temperature — ensure adequate irrigation');
    advisory.push('Mulch fields to conserve soil moisture');
  }
  
  if (weather.current.windSpeed > 30) {
    advisory.push('Strong winds — secure tall crops');
    advisory.push('Avoid chemical applications — spray drift risk');
  }
  
  if (crops.includes('onion') && weather.current.humidity > 80) {
    advisory.push('High humidity — monitor for fungal diseases in onions');
  }
  
  return advisory;
}
```

**Test Updates:**
- Mock `IWeatherService`
- Test signal computations
- Test location change triggers refresh
- Test advisory generation logic

**Success:** `npm run test` passes, component properly typed

---

### Step 7: Create Weather Alert Panel (1-2 hours)
**Files:**
- `projects/home/src/app/features/weather/alert-panel/weather-alert.component.ts`
- `projects/home/src/app/features/weather/alert-panel/weather-alert.component.html`
- `projects/home/src/app/features/weather/alert-panel/weather-alert.component.spec.ts`

**Features:**
- Display alerts from weather service
- Color-coded severity (red=high, yellow=medium, blue=low)
- Dismiss/acknowledge actions
- Responsive layout

**Test Coverage:**
- Alert rendering
- Severity styling
- Alert dismissal

---

### Step 8: Create Advisory Panel (1-2 hours)
**Files:**
- `projects/home/src/app/features/weather/advisory-panel/weather-advisory.component.ts`
- `projects/home/src/app/features/weather/advisory-panel/weather-advisory.component.html`
- `projects/home/src/app/features/weather/advisory-panel/weather-advisory.component.spec.ts`

**Features:**
- Display computed advisories from weather
- Icon indicators (warning, info, success)
- Crop-aware recommendations
- Linkage to activity scheduler (future)

---

### Step 9: Add Storage Extension (1 hour)
**Files:**
- `projects/home/src/app/core/storage/storage.interface.ts`
- `projects/home/src/app/core/storage/local-storage.service.ts`

**New Methods:**
```typescript
abstract getWeatherHistory(userId: string): Promise<WeatherData[]>;
abstract saveWeatherHistory(userId: string, history: WeatherData[]): Promise<void>;
```

**Implementation:**
- Store last 7 days of weather
- Key: `my_farm_{userId}_weather_history`
- Keep history in memory signal
- Integrate with weather service

**Success:** `npm run test` passes

---

### Step 10: Comprehensive Testing (3-4 hours)

**Unit Tests:**
- `weather.service.spec.ts` (API calls, error handling, caching, location)
- `weather-cache.service.spec.ts` (TTL, stale data, invalidation)
- `weather.component.spec.ts` (signal computations, location changes, service integration)
- `weather-alert.component.spec.ts` (alert rendering, severity styling)
- `weather-advisory.component.spec.ts` (advisory generation, icon mapping)

**Mock Utilities:**
- Create `/core/weather/testing/weather.mock.ts` with mock factory functions
- Mock HTTP responses for all OpenWeatherMap endpoints
- Mock AuthService with test user data

**Test Scenarios:**
- Successful API response + caching
- Rate limit error (429) → fallback to cache
- Network timeout → fallback to cache
- Missing location → use hardcoded default
- Location change → auto-refresh weather
- Stale data → revalidate in background
- Advisory generation for different crops

**Success Criteria:**
- `npm run test` all green
- Coverage >85% for service layer
- No console errors/warnings

---

### Step 11: Build & Lint Verification (1 hour)

**Verification:**
```bash
npm run build      # Zero warnings
npm run lint       # Zero errors
npm run test       # All tests pass
npm run format:check  # Format compliance
```

**Expected Output:** Clean builds, no TypeScript errors, no linting issues

---

### Step 12: Documentation (1 hour)

**Files:**
- `projects/home/WEATHER_API_SETUP.md` — Developer guide
- Inline code comments for complex logic
- API key setup instructions

---

## Success Criteria

### Functional
- ✅ Real weather data fetches from OpenWeatherMap
- ✅ Current metrics display correctly
- ✅ 5-day forecast renders with live data
- ✅ Weather alerts display for severe conditions
- ✅ Crop advisories generate based on weather
- ✅ Location changes trigger automatic refresh
- ✅ Stale vs. fresh data properly indicated

### Non-Functional
- ✅ API errors handled gracefully (4-tier fallback)
- ✅ Caching prevents rate limiting
- ✅ Response time <2s cached, <5s first load
- ✅ Bundle size increase <5KB

### Code Quality
- ✅ Service layer >85% test coverage
- ✅ `npm run lint` zero errors
- ✅ `npm run build` passes
- ✅ TypeScript strict mode compliance
- ✅ No console errors/warnings

---

## Phase 5 Preparation

The following are designed but deferred:
1. **Backend Weather Service** — Replace HTTP with backend-proxied calls
2. **Persistent Weather History** — Migrate from localStorage to backend
3. **Soil Sensor Integration** — Replace placeholder soil metrics with real IoT data
4. **Weather-Activity Correlation** — Link weather snapshots to activity records

### DI Swapping (Phase 5)
```typescript
// Current (Phase 4)
{ provide: IWeatherService, useClass: WeatherService }

// Phase 5 change (single line)
{ provide: IWeatherService, useClass: BackendWeatherService }

// Components unchanged ✓
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| API rate limits | 30-min cache + fallback to mock data + backend proxy (Phase 5) |
| API downtime | 4-tier fallback (cache → mock → error display) |
| Location not set | Auto-detect via AuthService or use hardcoded fallback |
| Performance impact | Memory-based cache only, no persistent storage bloat |
| API key exposure | Hardcoded in env files (Phase 5 moves to backend) |

---

## Timeline

| Step | Hours | Status |
|------|-------|--------|
| 1. Models & Interfaces | 2 | Pending |
| 2. API Configuration | 0.5 | Pending |
| 3. Cache Service | 2 | Pending |
| 4. HTTP Service | 4 | Pending |
| 5. DI Configuration | 0.5 | Pending |
| 6. Weather Component | 3 | Pending |
| 7. Alert Panel | 2 | Pending |
| 8. Advisory Panel | 2 | Pending |
| 9. Storage Extension | 1 | Pending |
| 10. Testing | 4 | Pending |
| 11. Build Verification | 1 | Pending |
| 12. Documentation | 1 | Pending |
| **Total** | **23** | |

---

## Files Summary

### New Files
- `/core/weather/weather.models.ts`
- `/core/weather/weather.interface.ts`
- `/core/weather/weather.service.ts` (+ .spec.ts)
- `/core/weather/weather-cache.service.ts` (+ .spec.ts)
- `/core/config/api.config.ts`
- `/features/weather/alert-panel/weather-alert.component.ts` (+ html, spec)
- `/features/weather/advisory-panel/weather-advisory.component.ts` (+ html, spec)
- `/core/weather/testing/weather.mock.ts`
- `projects/home/WEATHER_API_SETUP.md`

### Modified Files
- `/app.config.ts`
- `/features/weather/weather.component.ts` (+ .spec.ts)
- `/core/storage/storage.interface.ts`
- `/core/storage/local-storage.service.ts`

---

**Approved for Implementation**  
Model: Claude Haiku 4.5  
Branch: `claude/phase-4-weather-api`
