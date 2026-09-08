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
import { LocalStorageService } from './core/storage/local-storage.service';
import { OutboxStorageService } from './core/outbox/outbox-storage.service';
import { IWeatherService } from './core/weather/weather.interface';
import { WeatherService } from './core/weather/weather.service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideRouter(routes),
    // Switch between local and API storage:
    // { provide: IStorageService, useClass: LocalStorageService },  // Offline (no backend)
    { provide: IStorageService, useClass: OutboxStorageService }, // Stage 5: online + offline outbox
    { provide: IWeatherService, useClass: WeatherService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
