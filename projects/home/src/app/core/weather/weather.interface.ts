import { Signal } from '@angular/core';
import { WeatherData, WeatherLocation, CurrentWeather, WeatherAlert } from './weather.models';

export abstract class IWeatherService {
  abstract readonly weatherData: Signal<WeatherData | null>;
  abstract readonly isLoading: Signal<boolean>;
  abstract readonly error: Signal<string | null>;
  abstract getWeatherData(location: WeatherLocation): Promise<WeatherData>;
  abstract refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather>;
  abstract getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]>;
  abstract clearCache(): void;
  abstract getCachedWeather(): WeatherData | null;
}
