import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WeatherService } from './weather.service';
import { AuthService } from '../auth/auth.service';
import { WeatherCacheService } from './weather-cache.service';
import {
  WeatherLocation,
  OpenWeatherResponse,
  OpenWeatherForecastResponse,
} from './weather.models';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;
  let cacheService: WeatherCacheService;

  const testLocation: WeatherLocation = { lat: 19.1136, lng: 79.0882, name: 'Nashik' };

  const mockOpenWeatherResponse: OpenWeatherResponse = {
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
  };

  const mockForecastResponse: OpenWeatherForecastResponse = {
    list: [
      {
        dt: Math.floor(Date.now() / 1000),
        main: { temp_max: 29, temp_min: 22, temp: 25 },
        weather: [{ id: 801, main: 'Clouds', icon: '04d' }],
        clouds: { all: 50 },
        pop: 0.3,
      },
      {
        dt: Math.floor(Date.now() / 1000) + 86400,
        main: { temp_max: 26, temp_min: 20, temp: 23 },
        weather: [{ id: 500, main: 'Rain', icon: '10d' }],
        clouds: { all: 90 },
        pop: 0.8,
        rain: { '3h': 5 },
      },
    ],
  };

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WeatherService,
        WeatherCacheService,
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    cacheService = TestBed.inject(WeatherCacheService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch and return weather data', async () => {
    const promise = service.getWeatherData(testLocation);

    const currentReq = httpMock.expectOne((req) => req.url.includes('/weather'));
    currentReq.flush(mockOpenWeatherResponse);

    const forecastReq = httpMock.expectOne((req) => req.url.includes('/forecast'));
    forecastReq.flush(mockForecastResponse);

    const result = await promise;

    expect(result).toBeTruthy();
    expect(result.current.temp).toBe(28);
    expect(result.current.condition).toBe('Clouds');
    expect(result.forecast.days.length).toBeGreaterThan(0);
  });

  it('should return fresh data from cache', async () => {
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
    httpMock.expectNone((req) => req.url.includes('/weather'));
  });

  it('should handle API errors with fallback', async () => {
    const promise = service.getWeatherData(testLocation);

    const currentReq = httpMock.expectOne((req) => req.url.includes('/weather'));
    currentReq.error(new ErrorEvent('Network error'));

    const result = await promise;

    expect(result).toBeTruthy();
    expect(result.current).toBeTruthy();
    expect(result.isStale).toBeTrue();
  });

  it('should refresh current weather', async () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now(),
      isStale: false,
    };

    cacheService.set(testLocation, weatherData);

    const promise = service.refreshCurrentWeather(testLocation);

    const req = httpMock.expectOne((r) => r.url.includes('/weather'));
    req.flush(mockOpenWeatherResponse);

    const result = await promise;

    expect(result.temp).toBe(28);
    expect(result.condition).toBe('Clouds');
  });

  it('should fetch weather alerts', async () => {
    const mockAlertsResponse = {
      alerts: [
        {
          event: 'Heavy Rain',
          severity: 'high',
          description: 'Heavy rain expected',
          start: Math.floor(Date.now() / 1000),
          end: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
    };

    const promise = service.getWeatherAlerts(testLocation);

    const req = httpMock.expectOne((r) => r.url.includes('/weather/alerts'));
    req.flush(mockAlertsResponse);

    const alerts = await promise;

    expect(alerts.length).toBe(1);
    expect(alerts[0].title).toBe('Heavy Rain');
    expect(alerts[0].severity).toBe('high');
  });

  it('should return empty alerts on error', async () => {
    const promise = service.getWeatherAlerts(testLocation);

    const req = httpMock.expectOne((r) => r.url.includes('/weather/alerts'));
    req.error(new ErrorEvent('Network error'));

    const alerts = await promise;

    expect(alerts).toEqual([]);
  });

  it('should clear cache', async () => {
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

    expect(service.getCachedWeather()).toBeNull();
  });

  it('should return cached weather', async () => {
    const weatherData = {
      location: testLocation,
      current: { temp: 25, condition: 'Clear', fetchedAt: Date.now() } as any,
      forecast: { days: [], fetchedAt: Date.now() } as any,
      lastRefreshed: Date.now(),
      isStale: false,
    };

    cacheService.set(testLocation, weatherData);

    const cached = service.getCachedWeather();

    expect(cached).toEqual(weatherData);
  });

  it('should have loading and error signals', () => {
    expect(service.isLoading()).toBeFalse();
    expect(service.error()).toBeNull();
  });
});
