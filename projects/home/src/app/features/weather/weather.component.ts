import { Component, computed, signal, HostListener, inject, effect } from '@angular/core';
import { SunPathComponent } from './sun-path/sun-path.component';
import { HistoryTrendComponent } from './history-trend/history-trend.component';
import { AuthService } from '../../core/auth/auth.service';
import { IWeatherService } from '../../core/weather/weather.interface';
import { ProfileEditDialogComponent } from '../profile/components/profile-edit-dialog.component';

interface WeatherMetric {
  title: string;
  value: string;
  iconClass: string;
  textColorClass: string;
}

interface ForecastDay {
  dayName: string;
  dateLabel: string;
  temp: number;
  condition: string;
  iconClass: string;
  iconColorClass: string;
}

interface SoilMetric {
  name: string;
  value: number;
  unit: string;
  progressClass: string;
}

@Component({
  selector: 'app-weather',
  imports: [SunPathComponent, HistoryTrendComponent, ProfileEditDialogComponent],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.scss',
})
export class WeatherComponent {
  private readonly authService = inject(AuthService);
  private readonly weatherService = inject(IWeatherService);

  // Progressive location profiling signals
  readonly showLocationPrompt = computed(() => {
    const user = this.authService.currentUser();
    return user ? !user.village || !user.state : false;
  });

  readonly showEditDialog = signal(false);

  openLandDialog(): void {
    this.showEditDialog.set(true);
  }

  // Dropdown open state signal
  readonly dropdownOpen = signal(false);

  toggleDropdown(): void {
    this.dropdownOpen.update((open) => !open);
  }

  selectTab(tab: 'weekly' | 'monthly' | 'yearly'): void {
    this.activeHistoryTab.set(tab);
    this.dropdownOpen.set(false);
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  // Location information
  readonly locationName = computed(() => {
    const user = this.authService.currentUser();
    if (user) {
      if (user.village && user.state) {
        return `${user.village}, ${user.state}`;
      } else if (user.farmName) {
        return user.farmName;
      }
    }
    return 'Nashik, Maharashtra';
  });
  readonly locationSub = signal('Live Weather Monitoring');

  // Weather data from service
  readonly weatherData = computed(() => {
    this.authService.currentUser();
    return this.weatherService.weatherData();
  });

  // Today's weather computed signals
  readonly currentTemp = computed(() => this.weatherData()?.current.temp ?? 28);
  readonly currentCondition = computed(() => this.weatherData()?.current.condition ?? 'Partly Cloudy');
  readonly feelsLike = computed(() => this.weatherData()?.current.feelsLike ?? 31);

  readonly sunriseTime = computed(() => {
    const sunrise = this.weatherData()?.current.feelsLikeRange?.min;
    return sunrise ? new Date(sunrise).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '6:01 AM';
  });

  readonly sunsetTime = computed(() => {
    const sunset = this.weatherData()?.current.feelsLikeRange?.max;
    return sunset ? new Date(sunset).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '6:54 PM';
  });

  // Weather metrics list computed signal
  readonly metrics = computed<WeatherMetric[]>(() => {
    const weather = this.weatherData();
    return [
      {
        title: 'Temperature',
        value: `${this.currentTemp()}°C`,
        iconClass: 'bi-thermometer-half',
        textColorClass: 'text-temp',
      },
      {
        title: 'Rain Chance',
        value: `${weather?.current.rainProbability ?? 72}%`,
        iconClass: 'bi-cloud-rain-heavy-fill',
        textColorClass: 'text-rain',
      },
      {
        title: 'Wind Speed',
        value: `${weather?.current.windSpeed ?? 14} km/h`,
        iconClass: 'bi-wind',
        textColorClass: 'text-wind',
      },
      {
        title: 'Humidity',
        value: `${weather?.current.humidity ?? 68}%`,
        iconClass: 'bi-droplet-half',
        textColorClass: 'text-humidity',
      },
    ];
  });

  // Active period signal (0 = Period A, 1 = Period B)
  readonly activePeriod = signal<0 | 1>(0);

  // Forecast from service
  readonly forecast = computed(() => {
    const days = this.weatherData()?.forecast.days ?? [];
    return days.slice(0, 7).map((day: any) => ({
      dayName: day.dayName,
      dateLabel: day.dateLabel,
      temp: day.tempMax,
      condition: day.condition,
      iconClass: this.getIconClass(day.conditionCode),
      iconColorClass: this.getIconColorClass(day.condition),
    }));
  });

  readonly currentRange = computed(() => {
    const days = this.weatherData()?.forecast.days ?? [];
    if (days.length === 0) return '2 May – 8 May';
    const first = new Date(days[0].date);
    const last = new Date(days[Math.min(6, days.length - 1)].date);
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  });

  // Navigation handlers
  previousPeriod(): void {
    this.activePeriod.set(0);
  }

  nextPeriod(): void {
    this.activePeriod.set(1);
  }

  // Weather alerts
  readonly alerts = computed(() => this.weatherData()?.alerts ?? []);
  readonly urgentAlerts = computed(() => this.alerts().filter((a: any) => a.severity === 'high'));
  readonly showAlertBanner = computed(() => this.urgentAlerts().length > 0);

  // Crop advisory generated from weather
  readonly cropAdvisory = computed<string[]>(() => {
    const weather = this.weatherData();
    const user = this.authService.currentUser();
    if (!weather) return ['Unable to generate advisories'];
    return this.generateAdvisory(weather, user?.primaryCrops || []);
  });

  readonly farmerTip = computed(() => {
    const rain = this.weatherData()?.current.rainProbability ?? 0;
    if (rain > 70) {
      return 'Due to expected rainfall, delay fertilizer spraying to avoid nutrient washout and save costs.';
    }
    if ((this.weatherData()?.current.temp ?? 28) > 35) {
      return 'High temperature ahead - ensure fields are adequately irrigated to prevent crop stress.';
    }
    return 'Monitor weather conditions for optimal farming decisions.';
  });

  // Soil metrics signal (placeholder data awaiting IoT integration - Phase 5+)
  readonly soilMoisture = signal<SoilMetric>({
    name: 'Moisture',
    value: 62,
    unit: '%',
    progressClass: 'bg-success',
  });

  readonly soilTemp = signal<SoilMetric>({
    name: 'Soil Temperature',
    value: 24,
    unit: '°C',
    progressClass: 'bg-warning',
  });

  // Active History Trend tab selection signal
  readonly activeHistoryTab = signal<'weekly' | 'monthly' | 'yearly'>('weekly');

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user?.location) {
        this.weatherService.getWeatherData({
          lat: user.location.lat,
          lng: user.location.lng,
          name: user.village,
          state: user.state,
        });
      }
    });
  }

  private generateAdvisory(weather: any, crops: string[]): string[] {
    const advisory: string[] = [];

    if (weather.current.rainProbability > 70) {
      advisory.push('High rain expected — delay pesticide spraying');
      advisory.push('Good time for irrigation (rain will reduce water need)');
    }

    if (weather.current.temp > 35) {
      advisory.push('High temperature — ensure adequate irrigation');
      advisory.push('Mulch fields to conserve soil moisture');
    }

    if (weather.current.windSpeed > 30) {
      advisory.push('Strong winds — secure tall crops');
      advisory.push('Avoid chemical applications — spray drift risk');
    }

    if (crops.includes('onion') && weather.current.humidity > 80) {
      advisory.push('High humidity — monitor for fungal diseases in onions');
    }

    if (crops.includes('grape') && weather.current.uvIndex && weather.current.uvIndex > 8) {
      advisory.push('High UV index — provide shade for grape vines if possible');
    }

    if (advisory.length === 0) {
      advisory.push('Current weather conditions are favorable for farming operations');
    }

    return advisory;
  }

  private getIconClass(conditionCode: string): string {
    const iconMap: Record<string, string> = {
      '01d': 'bi-sun-fill',
      '01n': 'bi-moon-fill',
      '02d': 'bi-cloud-sun-fill',
      '02n': 'bi-cloud-moon-fill',
      '03d': 'bi-cloud-fill',
      '03n': 'bi-cloud-fill',
      '04d': 'bi-cloud-fill',
      '04n': 'bi-cloud-fill',
      '09d': 'bi-cloud-drizzle-fill',
      '09n': 'bi-cloud-drizzle-fill',
      '10d': 'bi-cloud-rain-fill',
      '10n': 'bi-cloud-rain-fill',
      '11d': 'bi-cloud-lightning-rain-fill',
      '11n': 'bi-cloud-lightning-rain-fill',
      '13d': 'bi-snow',
      '13n': 'bi-snow',
      '50d': 'bi-cloud-mist-fill',
      '50n': 'bi-cloud-mist-fill',
    };
    return iconMap[conditionCode] || 'bi-cloud-fill';
  }

  private getIconColorClass(condition: string): string {
    const colorMap: Record<string, string> = {
      Clear: 'text-warning',
      Sunny: 'text-warning',
      Clouds: 'text-muted',
      Cloudy: 'text-muted',
      'Partly Cloudy': 'text-warning',
      Rain: 'text-primary',
      Rainy: 'text-primary',
      Drizzle: 'text-info',
      Thunderstorm: 'text-danger',
      Stormy: 'text-danger',
      Snow: 'text-light',
      Mist: 'text-secondary',
    };
    return colorMap[condition] || 'text-muted';
  }
}
