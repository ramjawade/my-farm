import { Injectable, inject } from '@angular/core';
import { HttpService } from '../http/http.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { FarmResponse, FarmerResponse, FarmerUpdateRequest, FarmUpdateRequest } from './contracts';
import { DEFAULT_FARM_NAME, FarmsApiService } from './farms-api.service';
import { ReferenceDataService } from './reference-data.service';

type UserRole = NonNullable<FarmerUpdateRequest['user_role']>;

/** Role labels shown in the app ↔ the backend's role values. */
const ROLE_BY_LABEL: Record<string, UserRole> = {
  Farmer: 'farmer',
  'Farm Owner': 'farm_owner',
  Agronomist: 'agronomist',
  'Farm Worker': 'farm_worker',
  Student: 'student',
  Researcher: 'researcher',
  Gardener: 'gardener',
};
const LABEL_BY_ROLE = Object.fromEntries(
  Object.entries(ROLE_BY_LABEL).map(([label, role]) => [role, label]),
);

/** The label for a backend role value (unknown values pass through). */
export function roleLabel(role: string | null | undefined): string {
  return role ? (LABEL_BY_ROLE[role] ?? role) : 'Farmer';
}

const FARMER_KEYS = ['fullName', 'email', 'preferredLanguage', 'userRole'] as const;
const FARM_KEYS = [
  'farmName',
  'farmArea',
  'farmAreaUnit',
  'primaryCrops',
  'waterSource',
  'irrigationType',
  'farmingMethod',
  'locationType',
  'state',
  'district',
  'village',
  'pincode',
  'location',
  'farmSetupCompleted',
] as const;

const hasAny = (updates: object, keys: readonly string[]): boolean =>
  keys.some((key) => key in updates);

/**
 * Farmer profile (account), backed by the MyFarm backend via
 * Firebase-authenticated HTTP requests. Online-only — no offline outbox.
 */
@Injectable({ providedIn: 'root' })
export class FarmerProfileApiService {
  private writeQueue: Promise<unknown> = Promise.resolve();

  private readonly farms = inject(FarmsApiService);
  private readonly referenceData = inject(ReferenceDataService);

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

  /**
   * Persist profile edits: account fields to `/me`, farm fields to the
   * default farm (created on first save). Rejects if either write fails, so
   * callers can keep the edit on screen and say so.
   */
  saveProfile(updates: Partial<FarmerRegistrationData>): Promise<void> {
    return this.enqueueWrite(async () => {
      if (hasAny(updates, FARMER_KEYS)) {
        const body: FarmerUpdateRequest = {};
        if ('fullName' in updates) body.full_name = updates.fullName || null;
        if ('email' in updates) body.email = updates.email || null;
        if ('preferredLanguage' in updates) {
          body.preferred_language = updates.preferredLanguage || null;
        }
        if ('userRole' in updates) {
          body.user_role = ROLE_BY_LABEL[updates.userRole ?? ''] ?? 'farmer';
        }
        await this.httpService.patch<FarmerResponse>('/me', body);
      }
      if (hasAny(updates, FARM_KEYS)) {
        await this.farms.updateDefaultFarm(await this.toFarmUpdate(updates));
      }
    });
  }

  /** The farm-setup fields stored on the farmer's default farm (none → `{}`). */
  async getFarmFields(): Promise<Partial<FarmerRegistrationData>> {
    const farm = await this.farms.getDefaultFarm();
    if (!farm) return {};
    await this.referenceData.ready();
    return {
      farmName: farm.name === DEFAULT_FARM_NAME ? '' : farm.name,
      farmArea: farm.area ? Number(farm.area) : 0,
      farmAreaUnit: farm.area_unit === 'acres' ? 'acres' : 'hectares',
      primaryCrops: (farm.crop_catalog_ids ?? [])
        .map((id) => this.referenceData.cropName(id))
        .filter(Boolean),
      waterSource: farm.water_source ?? '',
      irrigationType: farm.irrigation_type ?? '',
      farmingMethod: farm.farming_method ?? '',
      locationType: this.toLocationType(farm),
      state: farm.state ?? '',
      district: farm.district ?? '',
      village: farm.village ?? '',
      pincode: farm.pincode ?? '',
      location:
        farm.lat != null && farm.lng != null
          ? { lat: Number(farm.lat), lng: Number(farm.lng) }
          : null,
      farmSetupCompleted: farm.setup_completed,
    };
  }

  private toLocationType(farm: FarmResponse): 'map' | 'manual' | 'skipped' {
    if (farm.location_type === 'map' || farm.location_type === 'manual') {
      return farm.location_type;
    }
    return 'skipped';
  }

  private async toFarmUpdate(updates: Partial<FarmerRegistrationData>): Promise<FarmUpdateRequest> {
    const body: FarmUpdateRequest = {};
    // The backend requires a name, so a cleared one reverts to the default.
    if ('farmName' in updates) body.name = updates.farmName?.trim() || DEFAULT_FARM_NAME;
    if ('farmArea' in updates) body.area = updates.farmArea ? String(updates.farmArea) : null;
    if ('farmAreaUnit' in updates && updates.farmAreaUnit) body.area_unit = updates.farmAreaUnit;
    if ('waterSource' in updates) body.water_source = updates.waterSource || null;
    if ('irrigationType' in updates) body.irrigation_type = updates.irrigationType || null;
    if ('farmingMethod' in updates) body.farming_method = updates.farmingMethod || null;
    if ('locationType' in updates) body.location_type = updates.locationType ?? null;
    if ('state' in updates) body.state = updates.state || null;
    if ('district' in updates) body.district = updates.district || null;
    if ('village' in updates) body.village = updates.village || null;
    if ('pincode' in updates) body.pincode = updates.pincode || null;
    if ('location' in updates) {
      body.lat = updates.location ? updates.location.lat : null;
      body.lng = updates.location ? updates.location.lng : null;
    }
    if ('farmSetupCompleted' in updates) body.setup_completed = !!updates.farmSetupCompleted;
    if ('primaryCrops' in updates) {
      const ids = await Promise.all(
        (updates.primaryCrops ?? []).map((name) => this.referenceData.cropCatalogIdForName(name)),
      );
      body.crop_catalog_ids = ids;
    }
    return body;
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
      userRole: roleLabel(item.user_role),
      createdAt: new Date(item.created_at).getTime(),
    };
  }
}
