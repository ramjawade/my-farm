import { Injectable } from '@angular/core';
import { WeatherData } from '../core/weather/weather.models';

/**
 * `WeatherApiService` backed by a plain in-memory array — no HTTP. Seed it
 * directly via the public array before a test runs.
 */
@Injectable()
export class FakeWeatherApiService {
  weather: WeatherData[] = [];

  async getWeatherHistory(): Promise<WeatherData[]> {
    return [...this.weather];
  }
  async saveWeatherSnapshot(_userId: number, snapshot: WeatherData): Promise<WeatherData> {
    this.weather.push(snapshot);
    return snapshot;
  }
}
