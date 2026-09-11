import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { IStorageService } from './core/storage/storage.interface';
import { ApiStorageService } from './core/api/api-storage.service';
import { IWeatherService } from './core/weather/weather.interface';
import { WeatherService } from './core/weather/weather.service';
import { provideEnvironmentInitializer } from './core/services/environment.initializer';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideRouter(routes),
    provideEnvironmentInitializer(),
    { provide: IStorageService, useClass: ApiStorageService }, // Online-only
    { provide: IWeatherService, useClass: WeatherService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
