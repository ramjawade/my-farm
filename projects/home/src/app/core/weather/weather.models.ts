export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  condition: string;
  conditionCode: string;
  humidity: number;
  windSpeed: number;
  windDirection?: number;
  rainProbability: number;
  rainfall?: number;
  pressure?: number;
  uvIndex?: number;
  visibility?: number;
  feelsLikeRange?: { min: number; max: number };
  fetchedAt: number;
}

export interface ForecastDay {
  date: number;
  dayName: string;
  dateLabel: string;
  tempMax: number;
  tempMin: number;
  condition: string;
  conditionCode: string;
  rainProbability: number;
  rainfall?: number;
  uvIndex?: number;
  sunrise?: number;
  sunset?: number;
}

export interface FiveDayForecast {
  days: ForecastDay[];
  fetchedAt: number;
}

export interface WeatherLocation {
  lat: number;
  lng: number;
  name?: string;
  state?: string;
  country?: string;
}

export interface WeatherData {
  location: WeatherLocation;
  current: CurrentWeather;
  forecast: FiveDayForecast;
  alerts?: WeatherAlert[];
  lastRefreshed: number;
  isStale: boolean;
}

export interface WeatherAlert {
  type: 'frost' | 'hail' | 'heavy_rain' | 'strong_wind' | 'dust' | 'other';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  effectiveAt: number;
  expiresAt: number;
}

export interface WeatherError {
  code: 'NETWORK_ERROR' | 'API_ERROR' | 'INVALID_LOCATION' | 'RATE_LIMITED' | 'UNKNOWN';
  message: string;
  statusCode?: number;
  timestamp: number;
}

// OpenWeatherMap API response types (internal)
export interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    visibility?: number;
  };
  weather: Array<{ id: number; main: string; description: string; icon: string }>;
  wind: { speed: number; deg?: number };
  clouds: { all: number };
  rain?: { '1h': number };
  snow?: { '1h': number };
  dt: number;
  sys?: { sunrise?: number; sunset?: number; country?: string };
  uvi?: number;
}

export interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number;
    main: { temp_max: number; temp_min: number; temp: number };
    weather: Array<{ id: number; main: string; icon: string }>;
    clouds: { all: number };
    pop: number;
    rain?: { '3h': number };
  }>;
}
