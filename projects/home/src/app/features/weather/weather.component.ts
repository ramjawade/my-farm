import { Component, computed, signal, HostListener } from '@angular/core';
import { SunPathComponent } from './sun-path/sun-path.component';
import { HistoryTrendComponent } from './history-trend/history-trend.component';

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
  imports: [SunPathComponent, HistoryTrendComponent],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.scss',
})
export class WeatherComponent {
  // Dropdown open state signal
  readonly dropdownOpen = signal(false);

  toggleDropdown(): void {
    this.dropdownOpen.update(open => !open);
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
  readonly locationName = signal('Nashik, Maharashtra');
  readonly locationSub = signal('Live Weather Monitoring');

  // Today's weather signals
  readonly currentTemp = signal(28);
  readonly currentCondition = signal('Partly Cloudy');
  readonly feelsLike = signal(31);
  readonly sunriseTime = signal('6:01 AM');
  readonly sunsetTime = signal('6:54 PM');

  // Weather metrics list computed signal
  readonly metrics = computed<WeatherMetric[]>(() => [
    {
      title: 'Temperature',
      value: `${this.currentTemp()}°C`,
      iconClass: 'bi-thermometer-half',
      textColorClass: 'text-temp',
    },
    {
      title: 'Rain Chance',
      value: '72%',
      iconClass: 'bi-cloud-rain-heavy-fill',
      textColorClass: 'text-rain',
    },
    {
      title: 'Wind Speed',
      value: '14 km/h',
      iconClass: 'bi-wind',
      textColorClass: 'text-wind',
    },
    {
      title: 'Humidity',
      value: '68%',
      iconClass: 'bi-droplet-half',
      textColorClass: 'text-humidity',
    },
  ]);

  // Active period signal (0 = Period A, 1 = Period B)
  readonly activePeriod = signal<0 | 1>(0);

  // Period ranges (aesthetic date labels)
  readonly periodRange = signal<string[]>([
    '2 May – 8 May',
    '9 May – 15 May'
  ]);

  // Combined forecasts for both periods
  readonly periodForecasts = signal<ForecastDay[][]>([
    [
      { dayName: 'Mon', dateLabel: '2 May', temp: 29, condition: 'Cloudy', iconClass: 'bi-cloud-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Tue', dateLabel: '3 May', temp: 26, condition: 'Rain', iconClass: 'bi-cloud-rain-fill', iconColorClass: 'text-primary' },
      { dayName: 'Wed', dateLabel: '4 May', temp: 31, condition: 'Sunny', iconClass: 'bi-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Thu', dateLabel: '5 May', temp: 27, condition: 'Drizzle', iconClass: 'bi-cloud-drizzle-fill', iconColorClass: 'text-info' },
      { dayName: 'Fri', dateLabel: '6 May', temp: 25, condition: 'Storm', iconClass: 'bi-cloud-lightning-rain-fill', iconColorClass: 'text-primary' },
      { dayName: 'Sat', dateLabel: '7 May', temp: 28, condition: 'Partly Cloudy', iconClass: 'bi-cloud-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Sun', dateLabel: '8 May', temp: 30, condition: 'Sunny', iconClass: 'bi-sun-fill', iconColorClass: 'text-warning' }
    ],
    [
      { dayName: 'Mon', dateLabel: '9 May', temp: 27, condition: 'Drizzle', iconClass: 'bi-cloud-drizzle-fill', iconColorClass: 'text-info' },
      { dayName: 'Tue', dateLabel: '10 May', temp: 28, condition: 'Cloudy', iconClass: 'bi-cloud-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Wed', dateLabel: '11 May', temp: 32, condition: 'Sunny', iconClass: 'bi-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Thu', dateLabel: '12 May', temp: 31, condition: 'Sunny', iconClass: 'bi-sun-fill', iconColorClass: 'text-warning' },
      { dayName: 'Fri', dateLabel: '13 May', temp: 26, condition: 'Rain', iconClass: 'bi-cloud-rain-fill', iconColorClass: 'text-primary' },
      { dayName: 'Sat', dateLabel: '14 May', temp: 25, condition: 'Storm', iconClass: 'bi-cloud-lightning-rain-fill', iconColorClass: 'text-primary' },
      { dayName: 'Sun', dateLabel: '15 May', temp: 29, condition: 'Partly Cloudy', iconClass: 'bi-cloud-sun-fill', iconColorClass: 'text-warning' }
    ]
  ]);

  // Computed properties
  readonly forecast = computed(() => this.periodForecasts()[this.activePeriod()]);
  readonly currentRange = computed(() => this.periodRange()[this.activePeriod()]);

  // Navigation handlers
  previousPeriod(): void {
    this.activePeriod.set(0);
  }

  nextPeriod(): void {
    this.activePeriod.set(1);
  }

  // Soil metrics signal
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

  // Crop Advisory list signal
  readonly cropAdvisory = signal<string[]>([
    'Good time for irrigation today.',
    'Expected rainfall in next 24 hours.',
    'Avoid pesticide spraying tomorrow.',
    'Suitable weather for onion and grape crops.',
  ]);

  readonly farmerTip = signal(
    'Due to expected rainfall tomorrow, delay fertilizer spraying to avoid nutrient washout and save costs.'
  );

  // Active History Trend tab selection signal
  readonly activeHistoryTab = signal<'weekly' | 'monthly' | 'yearly'>('weekly');
}
