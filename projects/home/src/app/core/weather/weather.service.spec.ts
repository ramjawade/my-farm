import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherService } from './weather.service';
import { AuthService } from '../auth/auth.service';
import { WeatherCacheService } from './weather-cache.service';
import { IStorageService } from '../storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';
import { WeatherLocation, OpenWeatherResponse } from './weather.models';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;
  let cacheService: WeatherCacheService;

  const testLocation: WeatherLocation = { lat: 19.1136, lng: 79.0882, name: 'Nashik' };

  // The backend's `/weather` response wraps the raw OpenWeather payload —
  // see `WeatherService.fetchFromBackend`, which reads `response.data`.
  const mockBackendResponse: { data: OpenWeatherResponse; source: string } = {
    source: 'live',
    data: {
      main: {
        temp: 28,
        feels_like: 31,
        humidity: 68,
        pressure: 1013,
        visibility: 10000,
      },
      weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
      wind: { speed: 3.9, deg: 290 },
      clouds: { all: 20 },
      dt: Math.floor(Date.now() / 1000),
    },
  };

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        WeatherService,
        WeatherCacheService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    });

    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
    cacheService = TestBed.inject(WeatherCacheService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch and return weather data from the single backend /weather endpoint', async () => {
    const promise = service.getWeatherData(testLocation);

    const req = httpMock.expectOne(
      (r) => r.url === '/api/v1/weather' && r.params.get('lat') === String(testLocation.lat),
    );
    req.flush(mockBackendResponse);

    const result = await promise;

    expect(result.current.temp).toBe(28);
    expect(result.current.condition).toBe('Clouds');
    expect(result.forecast.days.length).toBeGreaterThan(0);
    expect(result.isStale).toBeFalse();
    expect(service.source()).toBe('live');
  });

  it('should return fresh data from cache without a network call', async () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now(),
      isStale: false,
    };
    cacheService.set(testLocation, weatherData);

    const result = await service.getWeatherData(testLocation);

    expect(result).toEqual(weatherData);
    httpMock.expectNone((req) => req.url === '/api/v1/weather');
  });

  it('should fall back to mock data when the backend call fails and there is no cache', async () => {
    const promise = service.getWeatherData(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.error(new ErrorEvent('Network error'));

    const result = await promise;

    expect(result).toBeTruthy();
    expect(result.current).toBeTruthy();
    expect(result.isStale).toBeTrue();
    expect(service.source()).toBe('demo');
  });

  it('should fall back to stale cached data when the backend call fails', async () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now() - 60 * 60 * 1000,
      isStale: false,
    };
    // Backdate the cache entry past the freshness window so getWeatherData
    // attempts a live fetch instead of returning it directly.
    cacheService.set(testLocation, weatherData);
    spyOn(cacheService, 'isFresh').and.returnValue(false);

    const promise = service.getWeatherData(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.error(new ErrorEvent('Network error'));

    const result = await promise;

    expect(result.isStale).toBeTrue();
    expect(service.source()).toBe('cache');
  });

  it('should refresh current weather', async () => {
    const promise = service.refreshCurrentWeather(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.flush(mockBackendResponse);

    const result = await promise;

    expect(result.temp).toBe(28);
    expect(result.condition).toBe('Clouds');
  });

  it('should rethrow when refreshing current weather fails', async () => {
    const promise = service.refreshCurrentWeather(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.error(new ErrorEvent('Network error'));

    await expectAsync(promise).toBeRejected();
  });

  it('getWeatherAlerts returns no alerts (no alerts endpoint is wired up yet)', async () => {
    const promise = service.getWeatherAlerts(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.flush(mockBackendResponse);

    const alerts = await promise;

    expect(alerts).toEqual([]);
  });

  it('should return empty alerts on error', async () => {
    const promise = service.getWeatherAlerts(testLocation);

    const req = httpMock.expectOne((r) => r.url === '/api/v1/weather');
    req.error(new ErrorEvent('Network error'));

    const alerts = await promise;

    expect(alerts).toEqual([]);
  });

  it('should clear the cache and current weather', () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now(),
      isStale: false,
    };
    cacheService.set(testLocation, weatherData);
    expect(cacheService.get(testLocation)).toBeTruthy();

    service.clearCache();

    expect(cacheService.get(testLocation)).toBeNull();
    expect(service.getCachedWeather()).toBeNull();
  });

  it('should return the last fetched weather as cached weather', async () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now(),
      isStale: false,
    };
    cacheService.set(testLocation, weatherData);

    await service.getWeatherData(testLocation);

    expect(service.getCachedWeather()).toEqual(weatherData);
  });

  it('should have loading and error signals default to false/null', () => {
    expect(service.isLoading()).toBeFalse();
    expect(service.error()).toBeNull();
  });
});
