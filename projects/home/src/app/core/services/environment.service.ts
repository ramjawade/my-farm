import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Centralized access to the build-time environment configuration
 * (`environments/environment.ts` / `environment.prod.ts`).
 *
 * Inject this instead of importing the `environment` file directly, so
 * configuration access is testable and consistent across the app and
 * any lazy-loaded libraries.
 *
 * @example
 * constructor(private envService: EnvironmentService) {
 *   const apiUrl = this.envService.getApiUrl();
 *   const isDev = this.envService.isDevelopment();
 * }
 */
@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly config = environment;

  /** Whether this is a production build. */
  get production(): boolean {
    return this.config.production;
  }

  /** App version stamped at build time. */
  get appVersion(): string {
    return this.config.appVersion;
  }

  /** Build identifier stamped by CI (or `'dev'` locally). */
  get buildStamp(): string {
    return this.config.buildStamp;
  }

  /** Base URL for API requests. */
  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  /** OpenWeatherMap API key (dev only; unused now that weather calls are proxied server-side). */
  get openWeatherApiKey(): string {
    return (this.config as { openWeatherApiKey?: string }).openWeatherApiKey ?? '';
  }

  /** Returns the configured API base URL. */
  getApiUrl(): string {
    return this.config.apiBaseUrl;
  }

  /** Returns whether the app is running in development mode. */
  isDevelopment(): boolean {
    return !this.config.production;
  }

  /** Returns whether the app is running in production mode. */
  isProduction(): boolean {
    return this.config.production;
  }
}
