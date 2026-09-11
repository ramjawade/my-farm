import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EnvironmentService } from '../services/environment.service';

/**
 * Single entry point for backend HTTP calls. Every API-facing service
 * (`ApiStorageService`, `ReferenceDataService`, `SessionAuthService`,
 * `WeatherService`) goes through this instead of injecting `HttpClient`
 * directly, so the API host and the bearer token are set in exactly one
 * place — nothing else should read `EnvironmentService.getApiUrl()` or
 * hold its own auth token.
 */
@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);
  private readonly envService = inject(EnvironmentService);

  private token: string | null = null;

  /** Set (or, with `null`, clear) the bearer token sent with every request. */
  setAuthToken(token: string | null): void {
    this.token = token;
  }

  private url(path: string): string {
    return `${this.envService.getApiUrl()}${path}`;
  }

  private headers(): HttpHeaders {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return new HttpHeaders(headers);
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(this.url(path), {
        headers: this.headers(),
        params: params ? new HttpParams({ fromObject: params }) : undefined,
      }),
    );
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body, { headers: this.headers() }));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.url(path), body, { headers: this.headers() }));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.url(path), { headers: this.headers() }));
  }
}
