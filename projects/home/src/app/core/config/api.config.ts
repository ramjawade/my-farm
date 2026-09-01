export const API_CONFIG = {
  openWeatherMap: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    endpoints: {
      current: '/weather',
      forecast: '/forecast',
      alerts: '/weather/alerts',
    },
    // Note: API key should be set from environment
    // For local development, add to src/environments/environment.ts
    // For production, add to src/environments/environment.prod.ts
    // Phase 5: Move to backend proxy
    apiKey: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo-key',
  },
};
