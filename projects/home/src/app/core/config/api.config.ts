export const API_CONFIG = {
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    endpoints: {
      current: '/weather',
      forecast: '/forecast',
      alerts: '/weather/alerts',
    },
    // For local development: Set VITE_OPENWEATHER_API_KEY or use demo key
    // For production: Add to environment.prod.ts
    // Phase 5: Move to backend proxy
    apiKey: 'demo-key',
  },
};
