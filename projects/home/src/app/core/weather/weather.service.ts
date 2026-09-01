import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { IWeatherService } from './weather.interface';
import { WeatherCacheService } from './weather-cache.service';
import { WeatherData, WeatherLocation, CurrentWeather, WeatherAlert, OpenWeatherResponse, OpenWeatherForecastResponse } from './weather.models';
import { API_CONFIG } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class WeatherService extends IWeatherService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly cacheService = inject(WeatherCacheService);

  private readonly weatherDataSignal = signal<WeatherData | null>(null);
  readonly weatherData = computed(() => this.weatherDataSignal());

  private readonly loadingSignal = signal(false);
  readonly isLoading = computed(() => this.loadingSignal());

  private readonly errorSignal = signal<string | null>(null);
  readonly error = computed(() => this.errorSignal());

  readonly currentWeather = computed(() => this.weatherDataSignal());

  override async getWeatherData(location: WeatherLocation): Promise<WeatherData> {
    try {
      this.loadingSignal.set(true);
      this.errorSignal.set(null);

      // Check fresh cache first
      if (this.cacheService.isFresh(location)) {
        const cached = this.cacheService.get(location);
        if (cached) {
          this.weatherDataSignal.set(cached);
          this.loadingSignal.set(false);
          return cached;
        }
      }

      // Fetch from API
      const [current, forecast] = await Promise.all([
        this.fetchCurrentWeather(location),
        this.fetchForecast(location),
      ]);

      const weatherData: WeatherData = {
        location,
        current,
        forecast,
        alerts: await this.fetchAlerts(location).catch(() => []),
        lastRefreshed: Date.now(),
        isStale: false,
      };

      this.cacheService.set(location, weatherData);
      this.weatherDataSignal.set(weatherData);
      this.loadingSignal.set(false);

      return weatherData;
    } catch (error) {
      this.loadingSignal.set(false);
      return this.handleError(error, location);
    }
  }

  override async refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather> {
    try {
      const current = await this.fetchCurrentWeather(location);
      const cached = this.cacheService.get(location);

      if (cached) {
        cached.current = current;
        cached.lastRefreshed = Date.now();
        cached.isStale = false;
        this.cacheService.set(location, cached);
        this.weatherDataSignal.set(cached);
      }

      return current;
    } catch (error) {
      console.error('Failed to refresh current weather:', error);
      throw error;
    }
  }

  override async getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    try {
      return await this.fetchAlerts(location);
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

  private async fetchCurrentWeather(location: WeatherLocation): Promise<CurrentWeather> {
    const params = {
      lat: String(location.lat),
      lon: String(location.lng),
      appid: API_CONFIG.openWeatherMap.apiKey,
      units: 'metric',
    };

    const response = await this.http
      .get<OpenWeatherResponse>(`${API_CONFIG.openWeatherMap.baseUrl}/weather`, { params })
      .toPromise();

    if (!response) throw new Error('Empty response from weather API');

    return {
      temp: Math.round(response.main.temp),
      feelsLike: Math.round(response.main.feels_like),
      condition: response.weather[0]?.main || 'Unknown',
      conditionCode: response.weather[0]?.icon || 'unknown',
      humidity: response.main.humidity,
      windSpeed: Math.round(response.wind.speed * 3.6),
      windDirection: response.wind.deg,
      rainProbability: 0,
      rainfall: response.rain?.['1h'],
      pressure: response.main.pressure,
      uvIndex: response.uvi,
      visibility: response.main.visibility,
      fetchedAt: Date.now(),
    };
  }

  private async fetchForecast(location: WeatherLocation): Promise<{ days: any[]; fetchedAt: number }> {
    const params = {
      lat: String(location.lat),
      lon: String(location.lng),
      appid: API_CONFIG.openWeatherMap.apiKey,
      units: 'metric',
      cnt: '40',
    };

    const response = await this.http
      .get<OpenWeatherForecastResponse>(`${API_CONFIG.openWeatherMap.baseUrl}/forecast`, { params })
      .toPromise();

    if (!response?.list) throw new Error('Empty forecast response');

    const dayGroups = new Map<string, any[]>();
    response.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split('T')[0];
      if (!dayGroups.has(dateKey)) dayGroups.set(dateKey, []);
      dayGroups.get(dateKey)?.push(item);
    });

    const days = Array.from(dayGroups.entries())
      .slice(0, 5)
      .map(([dateStr, items]) => {
        const date = new Date(dateStr);
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        const temps = items.map((i) => i.main.temp);
        const popValues = items.map((i) => i.pop || 0);

        return {
          date: date.getTime(),
          dayName,
          dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          tempMax: Math.round(Math.max(...temps)),
          tempMin: Math.round(Math.min(...temps)),
          condition: items[0]?.weather[0]?.main || 'Unknown',
          conditionCode: items[0]?.weather[0]?.icon || 'unknown',
          rainProbability: Math.round((popValues.reduce((a, b) => a + b, 0) / popValues.length) * 100),
          rainfall: items.reduce((sum, i) => sum + (i.rain?.['3h'] || 0), 0),
          uvIndex: undefined,
        };
      });

    return { days, fetchedAt: Date.now() };
  }

  private async fetchAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    try {
      const params = {
        lat: String(location.lat),
        lon: String(location.lng),
        appid: API_CONFIG.openWeatherMap.apiKey,
      };

      const response = await this.http
        .get<{ alerts: any[] }>(`${API_CONFIG.openWeatherMap.baseUrl}/weather/alerts`, { params })
        .toPromise();

      return (response?.alerts || []).map((alert) => ({
        type: 'other' as const,
        severity: alert.severity || 'medium',
        title: alert.event || 'Weather Alert',
        description: alert.description || '',
        effectiveAt: alert.start * 1000,
        expiresAt: alert.end * 1000,
      }));
    } catch {
      return [];
    }
  }

  private handleError(error: any, location: WeatherLocation): WeatherData {
    console.error('Weather API error:', error);

    // Tier 2: Fallback to cached data
    const cached = this.cacheService.get(location);
    if (cached) {
      cached.isStale = true;
      this.weatherDataSignal.set(cached);
      this.errorSignal.set('Using cached weather data (network error)');
      return cached;
    }

    // Tier 3: Mock data
    this.errorSignal.set('Unable to fetch weather data');
    return this.getMockWeatherData(location);
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
          { date: Date.now(), dayName: 'Mon', dateLabel: 'May 2', tempMax: 29, tempMin: 22, condition: 'Cloudy', conditionCode: '04d', rainProbability: 30 },
          { date: Date.now() + 86400000, dayName: 'Tue', dateLabel: 'May 3', tempMax: 26, tempMin: 20, condition: 'Rainy', conditionCode: '10d', rainProbability: 80 },
          { date: Date.now() + 172800000, dayName: 'Wed', dateLabel: 'May 4', tempMax: 31, tempMin: 23, condition: 'Sunny', conditionCode: '01d', rainProbability: 10 },
          { date: Date.now() + 259200000, dayName: 'Thu', dateLabel: 'May 5', tempMax: 27, tempMin: 21, condition: 'Drizzle', conditionCode: '09d', rainProbability: 40 },
          { date: Date.now() + 345600000, dayName: 'Fri', dateLabel: 'May 6', tempMax: 25, tempMin: 19, condition: 'Stormy', conditionCode: '11d', rainProbability: 90 },
        ],
        fetchedAt: Date.now(),
      },
      lastRefreshed: Date.now(),
      isStale: true,
    };
  }
}
