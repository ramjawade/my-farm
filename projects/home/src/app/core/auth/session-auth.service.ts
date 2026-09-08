import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import {
  FarmerResponse,
  PhoneLookupResponse,
  RegisterRequest as RegisterBody,
  SessionRequest,
  SessionResponse,
} from '../api/contracts';

export interface SessionResult {
  token: string;
  farmer: FarmerRegistrationData;
}

/** App-facing input to `register()` (camelCase); mapped to the wire
 * `RegisterBody` from the API contracts before the request goes out. */
export interface RegisterRequest {
  phone: string;
  fullName: string;
  pin: string;
  preferredLanguage?: string;
}

function mapFarmer(f: FarmerResponse): FarmerRegistrationData {
  return {
    id: f.id,
    fullName: f.full_name ?? '',
    phone: f.phone ?? '',
    email: f.email ?? undefined,
    preferredLanguage: f.preferred_language ?? 'en',
    userRole: f.user_role ?? 'farmer',
    // The backend Farmer row has no farm-setup fields — Farm is a separate
    // entity — so these stay at their empty defaults, exactly as
    // ApiStorageService.mapFromBackendFarmer does.
    farmName: '',
    farmArea: 0,
    farmAreaUnit: 'acres',
    primaryCrops: [],
    waterSource: '',
    irrigationType: '',
    farmingMethod: '',
    locationType: 'skipped',
    location: null,
    createdAt: new Date(f.created_at).getTime(),
  };
}

/**
 * Talks to the backend PIN auth endpoints (issue #45). The raw PIN crosses
 * the wire over TLS; the backend stores only a salted hash and hands back a
 * short-lived session JWT that `AuthService` then attaches to every API
 * request.
 *
 * Every method fails soft: a network error (offline, backend down) resolves
 * to `null` / rethrows a typed marker so `LoginComponent` can fall back to
 * the local-only PIN path that still works against `LocalStorageService`.
 */
@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** True/false if the backend answered; `null` if it could not be reached. */
  async phoneExists(phone: string): Promise<boolean | null> {
    try {
      const resp = await firstValueFrom(
        this.http.get<PhoneLookupResponse>(`${this.baseUrl}/auth/lookup`, {
          params: { phone },
        }),
      );
      return resp.exists;
    } catch {
      return null;
    }
  }

  /**
   * Exchange phone + PIN for a session. `null` means the backend rejected
   * the credentials (401); a thrown error means it could not be reached.
   */
  async createSession(phone: string, pin: string): Promise<SessionResult | null> {
    try {
      const body: SessionRequest = { phone, pin };
      const resp = await firstValueFrom(
        this.http.post<SessionResponse>(`${this.baseUrl}/auth/session`, body),
      );
      return { token: resp.token, farmer: mapFarmer(resp.farmer) };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Register a new PIN account. `'phone-taken'` if the backend returned 409;
   * a thrown error means it could not be reached.
   */
  async register(req: RegisterRequest): Promise<SessionResult | 'phone-taken'> {
    try {
      const body: RegisterBody = {
        phone: req.phone,
        full_name: req.fullName,
        pin: req.pin,
        preferred_language: req.preferredLanguage ?? 'en',
      };
      const resp = await firstValueFrom(
        this.http.post<SessionResponse>(`${this.baseUrl}/auth/register`, body),
      );
      return { token: resp.token, farmer: mapFarmer(resp.farmer) };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        return 'phone-taken';
      }
      throw err;
    }
  }
}
