import { Injectable, signal } from '@angular/core';
import {
  CurrentWeather,
  WeatherAlert,
  WeatherData,
  WeatherDataSource,
  WeatherLocation,
} from '../core/weather/weather.models';

/** `IWeatherService` backed by writable signals — no HTTP. Records each requested location. */
@Injectable()
export class FakeWeatherService {
  readonly weatherData = signal<WeatherData | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly source = signal<WeatherDataSource>('live');

  readonly requested: WeatherLocation[] = [];

  async getWeatherData(location: WeatherLocation): Promise<WeatherData> {
    this.requested.push(location);
    return this.weatherData() as WeatherData;
  }
  async refreshCurrentWeather(): Promise<CurrentWeather> {
    return this.weatherData()!.current;
  }
  async getWeatherAlerts(): Promise<WeatherAlert[]> {
    return [];
  }
  clearCache(): void {
    this.weatherData.set(null);
  }
  getCachedWeather(): WeatherData | null {
    return this.weatherData();
  }

  /** Convenience for tests: publish conditions as the real service would after a fetch. */
  publish(current: Partial<CurrentWeather>, source: WeatherDataSource = 'live'): void {
    this.weatherData.set({
      location: { lat: 0, lng: 0 },
      current: {
        temp: 0,
        feelsLike: 0,
        condition: 'Clear',
        conditionCode: '01d',
        humidity: 0,
        windSpeed: 0,
        rainProbability: 0,
        fetchedAt: Date.now(),
        ...current,
      },
      forecast: { days: [], fetchedAt: Date.now() },
      alerts: [],
      lastRefreshed: Date.now(),
      isStale: false,
    } as WeatherData);
    this.source.set(source);
  }
}
