import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    endpoints: {
      current: '/weather',
      forecast: '/forecast',
      alerts: '/weather/alerts',
    },
    get apiKey(): string {
      return environment.openWeatherApiKey || 'demo-key';
    },
  },
};
