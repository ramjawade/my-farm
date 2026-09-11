import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { IStorageService } from '../storage/storage.interface';
import { SavedFarm } from '../../map/models/map.models';

/**
 * Read-only farm lookup service. Each page loads farms in its own ngOnInit
 * through this service, which depends on the user context and storage layer only.
 * No cache, no shared state — pure delegation to storage.
 */
@Injectable({
  providedIn: 'root',
})
export class FarmLookupService {
  private readonly authService = inject(AuthService);
  private readonly storage = inject(IStorageService);

  /**
   * Load farms for the currently signed-in user.
   * Returns empty array if no user is signed in.
   */
  async loadForCurrentUser(): Promise<SavedFarm[]> {
    const user = this.authService.currentUser();
    if (!user) return [];
    try {
      return await this.storage.getFarms(user.id);
    } catch (e) {
      console.error('Failed to load farms', e);
      return [];
    }
  }
}
