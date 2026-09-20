import { Injectable } from '@angular/core';
import { HttpService } from '../http/http.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { FarmerResponse, FarmerUpdateRequest } from './contracts';

/**
 * Farmer profile (account), backed by the MyFarm backend via
 * Firebase-authenticated HTTP requests. Online-only — no offline outbox.
 */
@Injectable({ providedIn: 'root' })
export class FarmerProfileApiService {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private httpService: HttpService) {}

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.writeQueue.then(() => fn());
    this.writeQueue = promise.catch(() => {
      // Continue the queue even if this write fails
    });
    return promise;
  }

  async getFarmerById(id: number): Promise<FarmerRegistrationData | undefined> {
    // The backend has no GET /farmers/{id} — the only farmer this token can
    // read is its own, via /me. `AuthService.loadSession` passes the active
    // user's id here, so a match is the normal case.
    try {
      const response = await this.httpService.get<FarmerResponse>('/me');
      return response.id === id ? this.mapFromBackendFarmer(response) : undefined;
    } catch (error) {
      console.error('Failed to get farmer by id:', error);
      return undefined;
    }
  }

  /**
   * Not supported on the API path. Sign-in is a single online
   * `POST /auth/session` (issue #50) — the login screen never resolves a
   * phone to a farmer record first, so there is nothing to return here.
   */
  async getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    return undefined;
  }

  async saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData> {
    return this.enqueueWrite(async () => {
      const body: FarmerUpdateRequest = {
        full_name: farmer.fullName || null,
        email: farmer.email ?? null,
        preferred_language: farmer.preferredLanguage || null,
      };
      try {
        const response = await this.httpService.patch<FarmerResponse>('/me', body);
        return this.mapFromBackendFarmer(response);
      } catch (error) {
        console.error('Failed to save farmer profile:', error);
        return farmer;
      }
    });
  }

  /** The farm-setup half of `FarmerRegistrationData` — the backend Farmer
   * row has none of these (Farm is a separate entity), so every farmer
   * mapped from the API starts here. */
  private blankFarmer(): FarmerRegistrationData {
    return {
      id: 0,
      fullName: '',
      phone: '',
      preferredLanguage: 'en',
      userRole: 'farmer',
      farmName: '',
      farmArea: 0,
      farmAreaUnit: 'acres',
      primaryCrops: [],
      waterSource: '',
      irrigationType: '',
      farmingMethod: '',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now(),
    };
  }

  private mapFromBackendFarmer(item: FarmerResponse): FarmerRegistrationData {
    return {
      ...this.blankFarmer(),
      id: item.id,
      fullName: item.full_name ?? '',
      phone: item.phone ?? '',
      email: item.email ?? undefined,
      preferredLanguage: item.preferred_language ?? 'en',
      userRole: item.user_role ?? 'farmer',
      createdAt: new Date(item.created_at).getTime(),
    };
  }
}
