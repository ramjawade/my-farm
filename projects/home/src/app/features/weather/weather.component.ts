import { weatherIconClass } from '../../core/weather/weather-icon';
import { I18n } from '../../core/i18n/i18n.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { TranslatePipe } from '@ngx-translate/core';
import { Component, computed, signal, HostListener, inject, effect, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SunPathComponent } from './sun-path/sun-path.component';
import { HistoryTrendComponent } from './history-trend/history-trend.component';
import { AuthService } from '../../core/auth/auth.service';
import { IWeatherService } from '../../core/weather/weather.interface';
import { ProfileEditDialogComponent } from '../profile/components/profile-edit-dialog.component';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherService } from '../../core/weather/weather.service';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';
import { OnboardingGuideService } from '../../core/workflow/onboarding-guide.service';
import { WorkflowPromptCardComponent } from '../shared/components/workflow-prompt-card.component';
import { centroidOf } from '../../core/weather/weather-location.util';

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
  imports: [
    TranslatePipe,
    SunPathComponent,
    HistoryTrendComponent,
    ProfileEditDialogComponent,
    WorkflowPromptCardComponent,
  ],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.scss',
})
export class WeatherComponent implements OnInit {
  private readonly i18n = inject(I18n);
  private readonly locale = inject(LocaleService);
  private readonly authService = inject(AuthService);
  private readonly weatherService = inject(IWeatherService);
  private readonly farmDraw = inject(FarmDrawService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly onboardingService = inject(OnboardingGuideService);
  private readonly router = inject(Router);

  readonly farms = signal<SavedFarm[]>([]);

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      this.farms.set(await this.farmDraw.loadFarms(user.id));
    }
  }

  onBackClicked(): void {
    this.router.navigate(['/']);
  }

  // Progressive location profiling signals
  readonly shouldShowLocationPrompt = computed(() => {
    const user = this.authService.currentUser();
    const hasLocation = user ? user.village && user.state : false;
    const promptNotDismissed = this.onboardingService.shouldShowPrompt('location');
    return !hasLocation && promptNotDismissed && this.workflowService.isFirstTime();
  });

  readonly showLocationPrompt = computed(() => {
    const user = this.authService.currentUser();
    return user ? !user.village || !user.state : false;
  });

  readonly showEditDialog = signal(false);

  openLandDialog(): void {
    this.showEditDialog.set(true);
  }

  onLocationPromptAction(): void {
    this.openLandDialog();
  }

  onLocationPromptDismiss(): void {
    this.onboardingService.dismissPrompt('location');
  }

  onLocationSet(): void {
    this.workflowService.markPhaseComplete('location');
    this.onboardingService.dismissPrompt('location');
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
  private getLocationForDisplay(): { name: string; state: string } {
    const savedFarms = this.farms();
    if (savedFarms.length > 0) {
      return {
        name: savedFarms[0].name,
        state: this.authService.currentUser()?.state || 'Unknown',
      };
    }
    const user = this.authService.currentUser();
    if (user?.village && user?.state) {
      return { name: user.village, state: user.state };
    }
    return { name: 'Nashik', state: 'Maharashtra' };
  }

  readonly locationName = computed(() => {
    this.farms();
    this.authService.currentUser();
    const loc = this.getLocationForDisplay();
    return `${loc.name}, ${loc.state}`;
  });
  readonly locationSub = computed(() => {
    const source = this.weatherService.source();
    return source === 'live'
      ? this.i18n.t('weather.sourceLive')
      : source === 'cache'
        ? this.i18n.t('weather.sourceCached')
        : this.i18n.t('weather.sourceSample');
  });

  readonly sourceDisplay = computed(() => {
    const source = this.weatherService.source();
    return source === 'live'
      ? this.i18n.t('weather.badgeLive')
      : source === 'cache'
        ? this.i18n.t('weather.badgeCached')
        : this.i18n.t('weather.badgeDemo');
  });

  readonly sourceBadgeClass = computed(() => {
    const source = this.weatherService.source();
    return source === 'live' ? 'bg-success' : source === 'cache' ? 'bg-warning' : 'bg-secondary';
  });

  // A small badge alone is easy to miss — surface an unmissable banner
  // whenever what's on screen is mock data, not a real forecast.
  readonly isDemoData = computed(() => this.weatherService.source() === 'demo');

  // Weather data from service
  readonly weatherData = computed(() => {
    this.authService.currentUser();
    return this.weatherService.weatherData();
  });

  // Today's weather computed signals
  readonly currentTemp = computed(() => this.weatherData()?.current.temp ?? 28);
  readonly currentCondition = computed(
    () => this.weatherData()?.current.condition ?? this.i18n.t('weather.partlyCloudy'),
  );
  readonly feelsLike = computed(() => this.weatherData()?.current.feelsLike ?? 31);

  readonly sunriseTime = computed(() => {
    const sunrise = this.weatherData()?.current.feelsLikeRange?.min;
    return sunrise
      ? new Date(sunrise).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '6:01 AM';
  });

  readonly sunsetTime = computed(() => {
    const sunset = this.weatherData()?.current.feelsLikeRange?.max;
    return sunset
      ? new Date(sunset).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '6:54 PM';
  });

  // Weather metrics list computed signal
  readonly metrics = computed<WeatherMetric[]>(() => {
    const weather = this.weatherData();
    return [
      {
        title: this.i18n.t('weather.temperature'),
        value: `${this.currentTemp()}°C`,
        iconClass: 'bi-thermometer-half',
        textColorClass: 'text-temp',
      },
      {
        title: this.i18n.t('weather.rainChance'),
        value: `${weather?.current.rainProbability ?? 72}%`,
        iconClass: 'bi-cloud-rain-heavy-fill',
        textColorClass: 'text-rain',
      },
      {
        title: this.i18n.t('weather.windSpeed'),
        value: `${weather?.current.windSpeed ?? 14} km/h`,
        iconClass: 'bi-wind',
        textColorClass: 'text-wind',
      },
      {
        title: this.i18n.t('weather.humidity'),
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
      dayName: this.locale.date(day.date, 'EEE'),
      dateLabel: this.locale.date(day.date, 'd MMM'),
      temp: day.tempMax,
      condition: day.condition,
      iconClass: this.getIconClass(day.conditionCode),
      iconColorClass: this.getIconColorClass(day.condition),
    }));
  });

  readonly currentRange = computed(() => {
    const days = this.weatherData()?.forecast.days ?? [];
    if (days.length === 0) {
      const start = new Date();
      const end = new Date(start.getTime() + 6 * 86_400_000);
      return `${this.locale.date(start, 'd MMM')} – ${this.locale.date(end, 'd MMM')}`;
    }
    const first = new Date(days[0].date);
    if (days.length === 1) {
      return this.locale.date(first, 'd MMM');
    }
    const last = new Date(days[Math.min(6, days.length - 1)].date);
    return `${this.locale.date(first, 'd MMM')} – ${this.locale.date(last, 'd MMM')}`;
  });

  /**
   * The backend `/weather` proxy only returns OpenWeather's *current*
   * conditions (see `WeatherService.fetchFromBackend`'s TODO) -- there's no
   * real multi-day forecast endpoint yet, so `forecast` here is at most 1
   * day. Heading text must say so honestly rather than always claiming
   * "7 Day Forecast" for a single day.
   */
  readonly forecastHeading = computed(() => {
    const count = this.forecast().length;
    return count > 1
      ? this.i18n.t('weather.forecastDays', { count })
      : this.i18n.t('weather.forecastToday');
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
    if (!weather) return [this.i18n.t('weather.noAdvisories')];
    return this.generateAdvisory(weather, user?.primaryCrops || []);
  });

  readonly farmerTip = computed(() => {
    const rain = this.weatherData()?.current.rainProbability ?? 0;
    if (rain > 70) {
      return this.i18n.t('weather.tipRain');
    }
    if ((this.weatherData()?.current.temp ?? 28) > 35) {
      return this.i18n.t('weather.tipHeat');
    }
    return this.i18n.t('weather.tipDefault');
  });

  // Soil metrics signal (placeholder data awaiting IoT integration - Phase 5+)
  readonly soilMoisture = signal<SoilMetric>({
    name: 'weather.moisture',
    value: 62,
    unit: '%',
    progressClass: 'bg-success',
  });

  readonly soilTemp = signal<SoilMetric>({
    name: 'weather.soilTemperature',
    value: 24,
    unit: '°C',
    progressClass: 'bg-warning',
  });

  // Active History Trend tab selection signal
  readonly activeHistoryTab = signal<'weekly' | 'monthly' | 'yearly'>('weekly');

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      this.farms();
      if (user) {
        const loc = this.getLocationForDisplay();
        const location = this.getResolvedLocation();
        this.weatherService.getWeatherData(location);
      }
    });
  }

  private getResolvedLocation(): { lat: number; lng: number; name: string; state: string } {
    const savedFarms = this.farms();
    if (savedFarms.length > 0) {
      const farm = savedFarms[0];
      const centroid = this.calculateCentroid(farm.points);
      return {
        lat: centroid.lat,
        lng: centroid.lng,
        name: farm.name,
        state: this.authService.currentUser()?.state || 'Unknown',
      };
    }

    const user = this.authService.currentUser();
    if (user?.location) {
      return {
        lat: user.location.lat,
        lng: user.location.lng,
        name: user.village || 'Profile Location',
        state: user.state || 'Unknown',
      };
    }

    return {
      lat: 19.1136,
      lng: 79.0882,
      name: 'Nashik',
      state: 'Maharashtra',
    };
  }

  private calculateCentroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
    return centroidOf(points) ?? { lat: 19.1136, lng: 79.0882 };
  }

  private generateAdvisory(weather: any, crops: string[]): string[] {
    const advisory: string[] = [];

    if (weather.current.rainProbability > 70) {
      advisory.push(this.i18n.t('weather.advRain1'));
      advisory.push(this.i18n.t('weather.advRain2'));
    }

    if (weather.current.temp > 35) {
      advisory.push(this.i18n.t('weather.advHeat1'));
      advisory.push(this.i18n.t('weather.advHeat2'));
    }

    if (weather.current.windSpeed > 30) {
      advisory.push(this.i18n.t('weather.advWind1'));
      advisory.push(this.i18n.t('weather.advWind2'));
    }

    if (crops.includes('onion') && weather.current.humidity > 80) {
      advisory.push(this.i18n.t('weather.advOnion'));
    }

    if (crops.includes('grape') && weather.current.uvIndex && weather.current.uvIndex > 8) {
      advisory.push(this.i18n.t('weather.advGrape'));
    }

    if (advisory.length === 0) {
      advisory.push(this.i18n.t('weather.advFavorable'));
    }

    return advisory;
  }

  private getIconClass(conditionCode: string): string {
    return weatherIconClass(conditionCode);
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
