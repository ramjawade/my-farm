import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { IStorageService } from '../storage/storage.interface';
import { BackupFile } from '../storage/backup.models';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { CropTimelineService } from '../../features/crop-timeline/crop-timeline.service';
import { ActivityService } from '../../features/activity/activity.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { DEMO_FARMER, DEMO_USER_ID, buildDemoDataset } from './demo-dataset';

/**
 * Owns the guest demo account and whole-account data operations
 * (seed, reset, backup, restore). Feature services never seed on their own.
 */
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly storage = inject(IStorageService);
  private readonly auth = inject(AuthService);
  private readonly farmers = inject(FarmerRegistrationService);
  private readonly crops = inject(CropTimelineService);
  private readonly activities = inject(ActivityService);
  private readonly lands = inject(FarmDrawService);

  /** True when the signed-in user is the guest demo account. */
  readonly isDemoUser = computed(() => this.auth.currentUser()?.id === DEMO_USER_ID);

  /** Sign in as the demo farmer, seeding the demo farm on first use. */
  async enterDemo(): Promise<void> {
    await this.farmers.ready;
    this.farmers.upsertFarmer(DEMO_FARMER);
    await this.seedIfEmpty();
    this.auth.login(DEMO_FARMER);
  }

  /** Write the demo dataset for the demo user unless data already exists. */
  async seedIfEmpty(): Promise<void> {
    const [farms, crops, acts] = await Promise.all([
      this.storage.getFarms(DEMO_USER_ID),
      this.storage.getCrops(DEMO_USER_ID),
      this.storage.getActivities(DEMO_USER_ID),
    ]);
    if (farms.length || crops.length || acts.length) return;
    await this.writeSeed();
  }

  /** Wipe the demo user's data and re-seed it, then refresh in-memory state. */
  async resetDemoData(): Promise<void> {
    await this.storage.clearUserData(DEMO_USER_ID);
    await this.writeSeed();
    this.farmers.upsertFarmer(DEMO_FARMER);
    if (this.auth.currentUser()?.id === DEMO_USER_ID) {
      this.auth.updateProfile(DEMO_FARMER);
    }
    await this.reloadAll();
  }

  /** Export everything the signed-in user owns. */
  async exportBackup(): Promise<BackupFile | null> {
    const user = this.auth.currentUser();
    if (!user) return null;
    return this.storage.exportUserData(user.id);
  }

  /** Replace the signed-in user's data with a backup and refresh in-memory state. */
  async restoreBackup(backup: BackupFile): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    await this.storage.importUserData(user.id, backup);
    if (backup.farmer) {
      this.auth.updateProfile({ ...backup.farmer, id: user.id, pinHash: user.pinHash });
    }
    await this.reloadAll();
  }

  /** Delete all farm data for the signed-in user (account itself is kept). */
  async clearMyData(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    await this.storage.clearUserData(user.id);
    await this.reloadAll();
  }

  private async writeSeed(): Promise<void> {
    const data = buildDemoDataset();
    await this.storage.saveFarms(DEMO_USER_ID, data.farms);
    await this.storage.saveCrops(DEMO_USER_ID, data.crops);
    await this.storage.importUserData(DEMO_USER_ID, {
      app: 'my-farm',
      schemaVersion: 2,
      exportedAt: Date.now(),
      userId: DEMO_USER_ID,
      farms: data.farms,
      crops: data.crops,
      activities: data.activities,
      expenses: data.expenses,
      weatherHistory: [],
    });
  }

  private async reloadAll(): Promise<void> {
    await Promise.all([this.lands.reload(), this.crops.reload(), this.activities.reload()]);
  }
}
