import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EnvironmentService } from '../services/environment.service';
import { ToastService } from 'shared';

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
  private readonly toast = inject(ToastService);

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
    return this.withErrorToast(
      firstValueFrom(
        this.http.get<T>(this.url(path), {
          headers: this.headers(),
          params: params ? new HttpParams({ fromObject: params }) : undefined,
        }),
      ),
    );
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.withErrorToast(
      firstValueFrom(this.http.post<T>(this.url(path), body, { headers: this.headers() })),
    );
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.withErrorToast(
      firstValueFrom(this.http.patch<T>(this.url(path), body, { headers: this.headers() })),
    );
  }

  delete<T>(path: string): Promise<T> {
    return this.withErrorToast(
      firstValueFrom(this.http.delete<T>(this.url(path), { headers: this.headers() })),
    );
  }

  /**
   * Surface a toast for failures the user has no other way of noticing --
   * network errors and 5xx responses (e.g. a Render free-tier cold-start
   * timeout) -- without changing behavior otherwise: the original error is
   * always rethrown so existing call-site catch blocks (which mostly
   * degrade to an empty list) run exactly as before. Ordinary 4xx responses
   * (401 during session checks, 404 "not registered" probes, etc.) are left
   * alone -- those are expected outcomes their own call sites already
   * handle, not silent failures.
   */
  private async withErrorToast<T>(request: Promise<T>): Promise<T> {
    try {
      return await request;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) {
        this.toast.error("Couldn't reach the server. Please check your connection and try again.");
      }
      throw error;
    }
  }
}
