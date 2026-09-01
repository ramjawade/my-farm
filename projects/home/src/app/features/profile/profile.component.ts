import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileEditDialogComponent } from './components/profile-edit-dialog.component';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, ProfileEditDialogComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);

  // Read-only state
  readonly currentUser = this.authService.currentUser;
  
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
        day: 'numeric'
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
        farmSetupCompleted: false
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
        farmSetupCompleted: false
      });
    }
  }

  deleteOperations(): void {
    if (confirm('Are you sure you want to delete and reset your Operational Settings?')) {
      this.authService.updateProfile({
        waterSource: '',
        irrigationType: '',
        primaryCrops: [],
        farmSetupCompleted: false
      });
    }
  }
}
