import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { weatherIconClass } from '../../../core/weather/weather-icon';
import { CurrentWeather, ForecastDay } from '../../../core/weather/weather.models';

/** Today's weather: current conditions and, when available, the next three days. */
@Component({
  selector: 'app-home-weather-card',
  imports: [RouterLink, TranslatePipe, LocalNumberPipe],
  template: `
    <section class="card">
      <h2 class="fs-6 fw-bold d-flex justify-content-between align-items-center mb-2">
        {{ 'homeScreen.weather.title' | translate }}
        <a routerLink="/weather" class="fw-normal small text-decoration-none">
          {{ 'home.fullForecast' | translate }}
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </a>
      </h2>

      @if (!hasLocation()) {
        <div class="text-center text-body-secondary py-3">
          <p class="small mb-2">{{ 'home.weatherNoLocation' | translate }}</p>
          <a routerLink="/map" class="btn btn-sm btn-outline-success">{{
            'home.weatherSetLocation' | translate
          }}</a>
        </div>
      } @else if (weather(); as w) {
        <div class="d-flex align-items-center flex-wrap" style="gap: 14px">
          <i
            class="bi {{ iconClass() }} text-warning"
            style="font-size: 2.25rem"
            aria-hidden="true"
          ></i>
          <strong class="lh-1" style="font-family: var(--mf-font-display); font-size: 2.375rem"
            >{{ w.temp | localNumber: '1.0-0' }}°</strong
          >
          <div>
            <strong class="d-block">{{ w.condition }}</strong>
            <small class="text-body-secondary">
              {{
                ('homeScreen.weather.humidity' | translate) +
                  ' ' +
                  w.humidity +
                  '% · ' +
                  (('homeScreen.weather.wind' | translate) + ' ' + w.windSpeed + ' km/h')
              }}
            </small>
          </div>
        </div>
        @if (nextDays().length) {
          <div
            class="d-grid text-center"
            style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 12px"
          >
            @for (day of nextDays(); track day.date) {
              <div>
                <small class="text-body-secondary d-block">{{ day.dayName }}</small>
                <i class="bi {{ dayIcon(day) }} fs-5" aria-hidden="true"></i>
                <strong class="d-block">{{ day.tempMax | localNumber: '1.0-0' }}°</strong>
              </div>
            }
          </div>
        }
        @if (isSample()) {
          <div class="alert alert-warning py-2 px-3 small mt-3 mb-0" role="status">
            {{ 'home.weatherSample' | translate }}
          </div>
        }
      } @else {
        <p class="text-body-secondary small mb-0">{{ 'home.weatherLoading' | translate }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeWeatherCardComponent {
  readonly hasLocation = input(false);
  readonly weather = input<CurrentWeather | null>(null);
  readonly forecast = input<ForecastDay[]>([]);
  readonly isSample = input(false);

  readonly iconClass = computed(() => weatherIconClass(this.weather()?.conditionCode ?? ''));

  /** The three days after today, when the forecast holds them. */
  readonly nextDays = computed(() => this.forecast().slice(1, 4));

  dayIcon(day: ForecastDay): string {
    return weatherIconClass(day.conditionCode);
  }
}
