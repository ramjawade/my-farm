import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import {
  FarmerResponse,
  RegisterRequest as RegisterBody,
  SessionRequest,
  SessionResponse,
} from '../api/contracts';

export interface SessionResult {
  token: string;
  farmer: FarmerRegistrationData;
}

/** Outcome of a sign-in attempt (issue #50). `unreachable` is a real
 * network failure — never treated as "new user". */
export type SessionOutcome =
  | { status: 'ok'; result: SessionResult }
  | { status: 'no-account' }
  | { status: 'wrong-pin' }
  | { status: 'unreachable' };

/** Outcome of a registration attempt. */
export type RegisterOutcome =
  { status: 'ok'; result: SessionResult } | { status: 'phone-taken' } | { status: 'unreachable' };

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
 * The backend PIN auth endpoints (issues #45, #50).
 *
 * **Auth is online-only.** The raw PIN crosses the wire over TLS; the
 * backend stores only a salted hash and returns a short-lived session JWT
 * that `AuthService` attaches to every API request. There is deliberately
 * no offline path: an identity can't be minted offline and reconciled
 * later (phone uniqueness and the JWT are server-only, and there's no OTP
 * to prove ownership on merge). A network failure returns `unreachable`
 * and the login screen asks the user to retry — it never falls through to
 * creating a local account.
 */
@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Exchange phone + PIN for a session. The backend's status code maps
   * straight to the outcome — `404 -> no-account`, `401 -> wrong-pin` — so
   * there is no separate "does this phone exist" pre-check. */
  async createSession(phone: string, pin: string): Promise<SessionOutcome> {
    try {
      const body: SessionRequest = { phone, pin };
      const resp = await firstValueFrom(
        this.http.post<SessionResponse>(`${this.baseUrl}/auth/session`, body),
      );
      return { status: 'ok', result: { token: resp.token, farmer: mapFarmer(resp.farmer) } };
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 404) return { status: 'no-account' };
        if (err.status === 401) return { status: 'wrong-pin' };
      }
      return { status: 'unreachable' };
    }
  }

  /** Create a PIN account and return its session. */
  async register(req: RegisterRequest): Promise<RegisterOutcome> {
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
      return { status: 'ok', result: { token: resp.token, farmer: mapFarmer(resp.farmer) } };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        return { status: 'phone-taken' };
      }
      return { status: 'unreachable' };
    }
  }
}
