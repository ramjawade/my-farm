import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileEditDialogComponent } from './components/profile-edit-dialog.component';
import { ConfirmDialogComponent } from 'shared';
import { DemoDataService } from '../../core/demo/demo-data.service';
import { isBackupFile } from '../../core/storage/backup.models';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, ProfileEditDialogComponent, ConfirmDialogComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly demoData = inject(DemoDataService);

  // Read-only state
  readonly currentUser = this.authService.currentUser;

  // Data & backup (settings card)
  readonly isDemoUser = this.demoData.isDemoUser;
  readonly dataMessage = signal<{ kind: 'success' | 'danger'; text: string } | null>(null);
  readonly dataBusy = signal(false);
  readonly showResetConfirm = signal(false);
  readonly showClearConfirm = signal(false);

  // Modal dialog trigger states
  readonly activeSection = signal<'account' | 'agronomic' | 'land' | 'operations'>('account');
  readonly showEditDialog = signal(false);

  // computed helper properties
  readonly userInitials = computed(() => {
    const name = this.currentUser()?.fullName || 'User';
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  readonly memberSince = computed(() => {
    const time = this.currentUser()?.createdAt;
    if (!time) return 'N/A';
    try {
      return new Date(time).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  });

  openEditDialog(section: 'account' | 'agronomic' | 'land' | 'operations'): void {
    this.activeSection.set(section);
    this.showEditDialog.set(true);
  }

  deleteAgronomic(): void {
    if (confirm('Are you sure you want to delete and reset your Agronomic Settings?')) {
      this.authService.updateProfile({
        userRole: 'Farmer',
        farmingMethod: '',
        farmSetupCompleted: false,
      });
    }
  }

  deleteLandLocation(): void {
    if (confirm('Are you sure you want to delete and reset your Land & Location settings?')) {
      this.authService.updateProfile({
        farmName: '',
        farmArea: 0,
        farmAreaUnit: 'hectares',
        village: '',
        district: '',
        state: '',
        pincode: '',
        location: null,
        locationType: 'skipped',
        farmSetupCompleted: false,
      });
    }
  }

  deleteOperations(): void {
    if (confirm('Are you sure you want to delete and reset your Operational Settings?')) {
      this.authService.updateProfile({
        waterSource: '',
        irrigationType: '',
        primaryCrops: [],
        farmSetupCompleted: false,
      });
    }
  }

  // --- Data & backup ---
  async exportBackup(): Promise<void> {
    const backup = await this.demoData.exportBackup();
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `my-farm-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.dataMessage.set({ kind: 'success', text: 'Backup downloaded.' });
  }

  async onRestoreFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.dataBusy.set(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupFile(parsed)) {
        this.dataMessage.set({ kind: 'danger', text: 'That file is not a MyFarm backup.' });
        return;
      }
      await this.demoData.restoreBackup(parsed);
      this.dataMessage.set({
        kind: 'success',
        text: `Restored ${parsed.crops.length} crops, ${parsed.farms.length} lands and ${parsed.activities.length} activities.`,
      });
    } catch {
      this.dataMessage.set({ kind: 'danger', text: 'Could not read that backup file.' });
    } finally {
      this.dataBusy.set(false);
    }
  }

  async confirmResetDemo(): Promise<void> {
    this.dataBusy.set(true);
    try {
      await this.demoData.resetDemoData();
      this.dataMessage.set({ kind: 'success', text: 'Demo farm reset to its starting state.' });
    } finally {
      this.dataBusy.set(false);
    }
  }

  async confirmClearData(): Promise<void> {
    this.dataBusy.set(true);
    try {
      await this.demoData.clearMyData();
      this.dataMessage.set({ kind: 'success', text: 'All farm data cleared.' });
    } finally {
      this.dataBusy.set(false);
    }
  }
}
