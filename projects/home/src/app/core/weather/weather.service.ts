import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpService } from '../http/http.service';
import { IWeatherService } from './weather.interface';
import { WeatherCacheService } from './weather-cache.service';
import {
  WeatherData,
  WeatherLocation,
  CurrentWeather,
  WeatherAlert,
  OpenWeatherResponse,
  OpenWeatherForecastResponse,
} from './weather.models';
type DataSource = 'live' | 'cache' | 'demo';

@Injectable({ providedIn: 'root' })
export class WeatherService extends IWeatherService {
  private readonly httpService = inject(HttpService);
  private readonly cacheService = inject(WeatherCacheService);

  private readonly weatherDataSignal = signal<WeatherData | null>(null);
  readonly weatherData = computed(() => this.weatherDataSignal());

  private readonly loadingSignal = signal(false);
  readonly isLoading = computed(() => this.loadingSignal());

  private readonly errorSignal = signal<string | null>(null);
  readonly error = computed(() => this.errorSignal());

  readonly sourceSignal = signal<DataSource>('demo');
  readonly source = computed(() => this.sourceSignal());

  readonly currentWeather = computed(() => this.weatherDataSignal());

  override async getWeatherData(location: WeatherLocation): Promise<WeatherData> {
    try {
      this.loadingSignal.set(true);
      this.errorSignal.set(null);

      // Check fresh cache first
      if (this.cacheService.isFresh(location)) {
        const cached = this.cacheService.get(location);
        if (cached) {
          this.sourceSignal.set('cache');
          this.weatherDataSignal.set(cached);
          this.loadingSignal.set(false);
          return cached;
        }
      }

      // Fetch from backend endpoint (server-side caching and API key handling)
      try {
        const response = await this.fetchFromBackend(location);
        const weatherData: WeatherData = {
          location,
          current: response.current,
          forecast: response.forecast,
          alerts: response.alerts || [],
          lastRefreshed: Date.now(),
          isStale: false,
        };

        this.cacheService.set(location, weatherData);
        this.sourceSignal.set('live');
        this.weatherDataSignal.set(weatherData);
        this.loadingSignal.set(false);

        return weatherData;
      } catch (error) {
        // Fall through to cache/demo
      }

      // Fallback to cache or demo
      this.loadingSignal.set(false);
      return this.handleError(new Error('API fetch failed'), location);
    } catch (error) {
      this.loadingSignal.set(false);
      return this.handleError(error, location);
    }
  }

  override async refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather> {
    try {
      const response = await this.fetchFromBackend(location);
      const cached = this.cacheService.get(location);

      if (cached) {
        cached.current = response.current;
        cached.lastRefreshed = Date.now();
        cached.isStale = false;
        this.cacheService.set(location, cached);
        this.weatherDataSignal.set(cached);
      }

      return response.current;
    } catch (error) {
      console.error('Failed to refresh current weather:', error);
      throw error;
    }
  }

  override async getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    try {
      const response = await this.fetchFromBackend(location);
      return response.alerts || [];
    } catch (error) {
      console.error('Failed to fetch weather alerts:', error);
      return [];
    }
  }

  override clearCache(): void {
    this.cacheService.clear();
    this.weatherDataSignal.set(null);
    this.errorSignal.set(null);
  }

  override getCachedWeather(): WeatherData | null {
    return this.weatherDataSignal();
  }

  private handleError(error: any, location: WeatherLocation): WeatherData {
    console.error('Weather API error:', error);

    // Tier 2: Fallback to cached data
    const cached = this.cacheService.get(location);
    if (cached) {
      cached.isStale = true;
      this.sourceSignal.set('cache');
      this.weatherDataSignal.set(cached);
      this.errorSignal.set('Using cached weather data (network error)');
      return cached;
    }

    // Tier 3: Mock data
    this.sourceSignal.set('demo');
    this.errorSignal.set('Unable to fetch weather data');
    return this.getMockWeatherData(location);
  }

  private async fetchFromBackend(location: WeatherLocation): Promise<{
    current: CurrentWeather;
    forecast: { days: any[]; fetchedAt: number };
    alerts: WeatherAlert[];
  }> {
    const response = await this.httpService.get<{
      data: OpenWeatherResponse;
      source: string;
    }>('/weather', {
      lat: String(location.lat),
      lng: String(location.lng),
    });

    if (!response?.data) throw new Error('Empty response from backend weather API');

    const weatherData = response.data;
    const current: CurrentWeather = {
      temp: Math.round(weatherData.main.temp),
      feelsLike: Math.round(weatherData.main.feels_like),
      condition: weatherData.weather[0]?.main || 'Unknown',
      conditionCode: weatherData.weather[0]?.icon || 'unknown',
      humidity: weatherData.main.humidity,
      windSpeed: Math.round(weatherData.wind.speed * 3.6),
      windDirection: weatherData.wind.deg,
      rainProbability: 0,
      rainfall: weatherData.rain?.['1h'],
      pressure: weatherData.main.pressure,
      uvIndex: weatherData.uvi,
      visibility: (weatherData as any).visibility,
      fetchedAt: Date.now(),
    };

    // For now, return a simple forecast based on current data
    // TODO: Add forecast endpoint to backend
    const forecast = {
      days: [
        {
          date: Date.now(),
          dayName: new Date(Date.now()).toLocaleDateString('en-US', { weekday: 'short' }),
          dateLabel: new Date(Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          tempMax: current.temp,
          tempMin: current.temp - 3,
          condition: current.condition,
          conditionCode: current.conditionCode,
          rainProbability: current.rainProbability,
          rainfall: current.rainfall || 0,
          uvIndex: current.uvIndex,
        },
      ],
      fetchedAt: Date.now(),
    };

    return {
      current,
      forecast,
      alerts: [],
    };
  }

  private getMockWeatherData(location: WeatherLocation): WeatherData {
    return {
      location,
      current: {
        temp: 28,
        feelsLike: 31,
        condition: 'Partly Cloudy',
        conditionCode: '02d',
        humidity: 68,
        windSpeed: 14,
        rainProbability: 72,
        fetchedAt: Date.now(),
      },
      forecast: {
        days: [
          {
            date: Date.now(),
            dayName: 'Mon',
            dateLabel: 'May 2',
            tempMax: 29,
            tempMin: 22,
            condition: 'Cloudy',
            conditionCode: '04d',
            rainProbability: 30,
          },
          {
            date: Date.now() + 86400000,
            dayName: 'Tue',
            dateLabel: 'May 3',
            tempMax: 26,
            tempMin: 20,
            condition: 'Rainy',
            conditionCode: '10d',
            rainProbability: 80,
          },
          {
            date: Date.now() + 172800000,
            dayName: 'Wed',
            dateLabel: 'May 4',
            tempMax: 31,
            tempMin: 23,
            condition: 'Sunny',
            conditionCode: '01d',
            rainProbability: 10,
          },
          {
            date: Date.now() + 259200000,
            dayName: 'Thu',
            dateLabel: 'May 5',
            tempMax: 27,
            tempMin: 21,
            condition: 'Drizzle',
            conditionCode: '09d',
            rainProbability: 40,
          },
          {
            date: Date.now() + 345600000,
            dayName: 'Fri',
            dateLabel: 'May 6',
            tempMax: 25,
            tempMin: 19,
            condition: 'Stormy',
            conditionCode: '11d',
            rainProbability: 90,
          },
        ],
        fetchedAt: Date.now(),
      },
      lastRefreshed: Date.now(),
      isStale: true,
    };
  }
}
