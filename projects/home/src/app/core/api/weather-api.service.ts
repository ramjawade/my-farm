import { Injectable } from '@angular/core';
import { WeatherData } from '../weather/weather.models';

/**
 * Weather history. Deliberate no-ops, not errors: weather history isn't
 * persisted server-side — the live client-side OpenWeather path
 * (`WeatherService`) covers the MVP — and callers treat "no history" as
 * normal.
 */
@Injectable({ providedIn: 'root' })
export class WeatherApiService {
  async getWeatherHistory(userId: number): Promise<WeatherData[]> {
    return [];
  }

  async saveWeatherSnapshot(userId: number, snapshot: WeatherData): Promise<WeatherData> {
    return snapshot;
  }
}
