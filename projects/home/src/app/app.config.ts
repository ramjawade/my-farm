import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { IWeatherService } from './core/weather/weather.interface';
import { WeatherService } from './core/weather/weather.service';
import { provideEnvironmentInitializer } from './core/services/environment.initializer';
import { provideLanguageInitializer } from './core/i18n/language.initializer';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideRouter(
      routes,
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withComponentInputBinding(),
    ),
    provideEnvironmentInitializer(),
    // Relative prefix (no leading slash) so it resolves against `<base href>`
    // rather than the origin root — this app deploys under a subpath
    // (`--base-href /my-farm/` in `build:prod`), same as favicon.ico/manifest.webmanifest.
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
      lang: 'en',
      fallbackLang: 'en',
    }),
    provideLanguageInitializer(),
    { provide: IWeatherService, useClass: WeatherService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
