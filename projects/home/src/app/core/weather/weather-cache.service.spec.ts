import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { WeatherCacheService } from './weather-cache.service';
import { WeatherData, WeatherLocation, CurrentWeather, FiveDayForecast } from './weather.models';

describe('WeatherCacheService', () => {
  let service: WeatherCacheService;

  const testLocation: WeatherLocation = { lat: 19.1136, lng: 79.0882, name: 'Nashik' };
  const testWeatherData: WeatherData = {
    location: testLocation,
    current: {
      temp: 28,
      feelsLike: 31,
      condition: 'Partly Cloudy',
      conditionCode: '02d',
      humidity: 68,
      windSpeed: 14,
      rainProbability: 72,
      fetchedAt: Date.now(),
    } as CurrentWeather,
    forecast: { days: [], fetchedAt: Date.now() } as FiveDayForecast,
    lastRefreshed: Date.now(),
    isStale: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(WeatherCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve cached weather data', () => {
    service.set(testLocation, testWeatherData);
    const cached = service.get(testLocation);
    expect(cached).toEqual(testWeatherData);
  });

  it('should return null for non-cached location', () => {
    const nonCachedLocation: WeatherLocation = { lat: 20.0, lng: 80.0 };
    const cached = service.get(nonCachedLocation);
    expect(cached).toBeNull();
  });

  it('should identify fresh cache (within TTL)', () => {
    service.set(testLocation, testWeatherData);
    expect(service.isFresh(testLocation)).toBeTrue();
  });

  it('should identify stale cache after TTL expires', (done) => {
    service.set(testLocation, testWeatherData);
    expect(service.isFresh(testLocation)).toBeTrue();

    setTimeout(
      () => {
        expect(service.isFresh(testLocation)).toBeFalse();
        expect(service.isStale(testLocation)).toBeTrue();
        done();
      },
      31 * 60 * 1000 + 100,
    );
  });

  it('should handle multiple location caching', () => {
    const location2: WeatherLocation = { lat: 20.0, lng: 80.0, name: 'Mumbai' };
    const weatherData2: WeatherData = { ...testWeatherData, location: location2 };

    service.set(testLocation, testWeatherData);
    service.set(location2, weatherData2);

    expect(service.get(testLocation)).toEqual(testWeatherData);
    expect(service.get(location2)).toEqual(weatherData2);
  });

  it('should clear all cache', () => {
    service.set(testLocation, testWeatherData);
    expect(service.get(testLocation)).toBeTruthy();

    service.clear();
    expect(service.get(testLocation)).toBeNull();
  });

  it('should return -1 cache age for non-cached location', () => {
    const nonCachedLocation: WeatherLocation = { lat: 20.0, lng: 80.0 };
    expect(service.getCacheAge(nonCachedLocation)).toBe(-1);
  });

  it('should return accurate cache age for cached location', (done) => {
    service.set(testLocation, testWeatherData);
    setTimeout(() => {
      const age = service.getCacheAge(testLocation);
      expect(age).toBeGreaterThanOrEqual(100);
      expect(age).toBeLessThan(200);
      done();
    }, 100);
  });

  it('should mark cache as not stale before max age', () => {
    service.set(testLocation, testWeatherData);
    expect(service.isStale(testLocation)).toBeFalse();
  });

  it('should return null for expired cache (after max age)', (done) => {
    service.set(testLocation, testWeatherData);
    setTimeout(
      () => {
        expect(service.isStale(testLocation)).toBeTrue();
        done();
      },
      2 * 60 * 60 * 1000 + 100,
    );
  });
});
