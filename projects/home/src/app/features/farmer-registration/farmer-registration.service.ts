import { Injectable, inject } from '@angular/core';
import { FarmerRegistrationData } from './farmer-registration.models';
import { IStorageService } from '../../core/storage/storage.interface';

/** Normalise to the last 10 digits so formatting differences don't break lookup. */
function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
}

/**
 * Farmer accounts are looked up, never listed: there is no in-memory roster
 * here, and nothing in this service can dump every registered farmer.
 * `AuthService` resolves the signed-in user by id.
 *
 * On the API storage path most of this is thin: sign-in and backend
 * account creation run through `SessionAuthService` (online-only, issue
 * #50), and `upsertFarmer` just caches the farmer the backend returned so
 * `findById` works after a reload. `LocalStorageService` (the demo user)
 * still uses the full CRUD here, and the standalone `/register` wizard
 * still calls `registerFarmer` directly — see issue #50's follow-up.
 */
@Injectable({
  providedIn: 'root',
})
export class FarmerRegistrationService {
  private readonly storage = inject(IStorageService);

  /**
   * Create a farmer record through the storage layer. On the API path this
   * is only reached by the standalone `/register` wizard
   * (`FarmerRegistrationComponent`); the login screen creates backend
   * accounts via `SessionAuthService.register`.
   */
  registerFarmer(data: Omit<FarmerRegistrationData, 'id' | 'createdAt'>): FarmerRegistrationData {
    const newFarmer: FarmerRegistrationData = {
      ...data,
      id: this.generateUUID(),
      createdAt: Date.now(),
    };
    this.storage.saveFarmer(newFarmer).catch((e) => console.error('Failed to save farmer', e));
    return newFarmer;
  }

  /** Insert or replace a farmer record by id (used for demo / restore). */
  upsertFarmer(farmer: FarmerRegistrationData): void {
    this.storage.saveFarmer(farmer).catch((e) => console.error('Failed to save farmer', e));
  }

  async updateFarmer(
    id: string,
    updates: Partial<FarmerRegistrationData>,
  ): Promise<FarmerRegistrationData | null> {
    const existing = await this.storage.getFarmerById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await this.storage.saveFarmer(updated);
    return updated;
  }

  findById(id: string): Promise<FarmerRegistrationData | undefined> {
    return this.storage.getFarmerById(id);
  }

  findByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    return this.storage.getFarmerByPhone(normalizePhone(phone));
  }

  private generateUUID(): string {
    // Basic but unique enough for local storage ID generation
    return 'f-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }
}
