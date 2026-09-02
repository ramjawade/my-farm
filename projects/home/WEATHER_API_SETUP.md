# Weather API Setup Guide

## Overview

Phase 4 integrates OpenWeatherMap API for real-time weather data. The implementation uses a cached, fault-tolerant approach with signal-based state management.

## Configuration

### API Key Setup

The weather service currently uses a demo key. To use real data:

#### Option 1: Environment Variables (Recommended for Phase 5+)
Move API key to backend (Phase 5) where it's never exposed to client.

#### Option 2: Local Development
1. Generate API key at https://openweathermap.org/api
2. Update `api.config.ts`:
```typescript
apiKey: 'YOUR_API_KEY_HERE',
```

#### Option 3: Build-time Environment Variables
1. Add to `angular.json` under `projects.home.architect.build.options`:
```json
"defineConstants": {
  "OPENWEATHER_API_KEY": "YOUR_API_KEY"
}
```

## Service Architecture

### Components

**IWeatherService** (Abstract Interface)
- Contract for weather data fetching
- Signals for reactive state (`weatherData`, `isLoading`, `error`)
- Methods: `getWeatherData()`, `refreshCurrentWeather()`, `getWeatherAlerts()`

**WeatherService** (HTTP Implementation)
- Fetches from OpenWeatherMap API
- Transforms API responses to typed models
- 4-tier error fallback strategy

**WeatherCacheService** (Caching)
- 30-minute TTL for fresh data
- 2-hour maximum age for degraded service
- Location-based cache keys (lat,lng)

### Error Handling Strategy

**4-Tier Fallback:**
1. **Real API Data** — Fresh call succeeds
2. **Cached Data** — Network/API error, use last known data
3. **Mock Data** — Severe error, return sensible defaults
4. **Error Message** — Complete failure, show user-friendly message

## Data Models

### CurrentWeather
```typescript
{
  temp: number;              // °C
  feelsLike: number;         // °C
  condition: string;         // 'Clear', 'Cloudy', 'Rain', etc.
  humidity: number;          // 0-100%
  windSpeed: number;         // km/h
  rainProbability: number;   // 0-100%
  fetchedAt: number;         // timestamp
}
```

### ForecastDay
```typescript
{
  date: number;              // Day start timestamp
  dayName: string;           // 'Mon', 'Tue', etc.
  tempMax: number;           // °C
  tempMin: number;           // °C
  condition: string;
  rainProbability: number;   // 0-100%
}
```

### WeatherAlert
```typescript
{
  type: string;              // 'heavy_rain', 'strong_wind', etc.
  severity: string;          // 'low', 'medium', 'high'
  title: string;
  description: string;
  effectiveAt: number;       // start timestamp
  expiresAt: number;         // end timestamp
}
```

## Usage in Components

### Inject WeatherService

```typescript
import { IWeatherService } from '@core/weather/weather.interface';

export class MyComponent {
  private readonly weatherService = inject(IWeatherService);

  readonly weatherData = computed(() => 
    this.weatherService.weatherData()
  );

  readonly currentTemp = computed(() => 
    this.weatherData()?.current.temp ?? 28
  );
}
```

### Load Weather for Location

```typescript
constructor() {
  effect(() => {
    const user = this.authService.currentUser();
    if (user?.location) {
      this.weatherService.getWeatherData({
        lat: user.location.lat,
        lng: user.location.lng,
        name: user.village,
        state: user.state,
      });
    }
  });
}
```

### Generate Advisories

```typescript
readonly cropAdvisory = computed<string[]>(() => {
  const weather = this.weatherData();
  const user = this.authService.currentUser();
  const crops = user?.primaryCrops || [];
  
  const advisory: string[] = [];
  
  if (weather?.current.rainProbability > 70) {
    advisory.push('High rain — delay pesticide spraying');
  }
  
  if (weather?.current.temp > 35) {
    advisory.push('High temp — ensure irrigation');
  }
  
  return advisory;
});
```

## Testing

### Mock Weather Service

```typescript
import { WeatherData, WeatherLocation } from '@core/weather/weather.models';

const mockWeatherData: WeatherData = {
  location: { lat: 19.1136, lng: 79.0882 },
  current: {
    temp: 28,
    feelsLike: 31,
    condition: 'Partly Cloudy',
    humidity: 68,
    windSpeed: 14,
    rainProbability: 72,
    fetchedAt: Date.now(),
  },
  forecast: { days: [], fetchedAt: Date.now() },
  lastRefreshed: Date.now(),
  isStale: false,
};
```

### Unit Tests

```typescript
// Mock HTTP responses
const mockResponse: OpenWeatherResponse = {
  main: { temp: 28, feels_like: 31, humidity: 68, pressure: 1013 },
  weather: [{ id: 801, main: 'Clouds', icon: '02d' }],
  wind: { speed: 3.9 },
  clouds: { all: 20 },
  dt: Date.now() / 1000,
};

// Test with HttpTestingController
const req = httpMock.expectOne(r => r.url.includes('/weather'));
req.flush(mockResponse);
```

## Performance

### Bundle Size Impact
- Models + interfaces: ~2KB
- Service implementation: ~8KB
- Components: ~6KB
- Total: ~16KB (with all dependencies)

### Network Performance
- First load: ~200ms (API call)
- Cached load: 0ms (in-memory signal)
- Refresh: ~200ms (30-min TTL)

### Memory Usage
- Single location cache: ~5KB per entry
- Multiple locations: Scales linearly

## Troubleshooting

### Weather Data Not Loading
1. Check browser console for errors
2. Verify user has location set (village + state)
3. Check if API key is valid
4. Ensure location coordinates are correct

### Rate Limiting (429 Error)
- Cache is working (fallback to cached data)
- Wait for cache TTL to expire (30 min)
- Phase 5: Move to backend to handle rate limiting globally

### Mock Data Showing
- API call failed, fallback to mock data active
- Check network tab for actual error
- Verify API key and endpoint configuration

## Phase 5 Migration

To migrate to backend weather proxy:

1. **Create BackendWeatherService**
```typescript
export class BackendWeatherService extends IWeatherService {
  // Implement via HTTP calls to backend
}
```

2. **Update DI binding** in `app.config.ts`:
```typescript
// Change from:
{ provide: IWeatherService, useClass: WeatherService }

// To:
{ provide: IWeatherService, useClass: BackendWeatherService }
```

3. **Components remain unchanged** — Power of abstract interfaces!

## Related Files

- `/core/weather/weather.interface.ts` — Abstract contract
- `/core/weather/weather.service.ts` — HTTP implementation
- `/core/weather/weather-cache.service.ts` — Caching logic
- `/core/weather/weather.models.ts` — TypeScript interfaces
- `/features/weather/weather.component.ts` — Component integration
- `/features/weather/alert-panel/` — Alert display component
- `/features/weather/advisory-panel/` — Advisory display component
