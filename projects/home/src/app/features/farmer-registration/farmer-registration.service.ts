import { Injectable, inject } from '@angular/core';
import { FarmerRegistrationData } from './farmer-registration.models';
import { IStorageService } from '../../core/storage/storage.interface';

/**
 * Caches and fetches the signed-in farmer's own record — nothing here can
 * list or dump farmers.
 *
 * Sign-in and account creation run through `SessionAuthService` (online-only,
 * issues #45 / #50); this service only keeps the farmer the backend returned
 * in local storage so `findById` works across a reload, and lets the demo /
 * `LocalStorageService` path persist profile edits.
 */
@Injectable({
  providedIn: 'root',
})
export class FarmerRegistrationService {
  private readonly storage = inject(IStorageService);

  /** Insert or replace a farmer record by id (post-login cache, demo restore,
   * profile edits via `AuthService.updateProfile`). */
  upsertFarmer(farmer: FarmerRegistrationData): void {
    this.storage.saveFarmer(farmer).catch((e) => console.error('Failed to save farmer', e));
  }

  findById(id: string): Promise<FarmerRegistrationData | undefined> {
    return this.storage.getFarmerById(id);
  }
}
