import { WeatherData, WeatherLocation, CurrentWeather, WeatherAlert } from './weather.models';

export abstract class IWeatherService {
  abstract getWeatherData(location: WeatherLocation): Promise<WeatherData>;
  abstract refreshCurrentWeather(location: WeatherLocation): Promise<CurrentWeather>;
  abstract getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]>;
  abstract clearCache(): void;
  abstract getCachedWeather(): WeatherData | null;
}
