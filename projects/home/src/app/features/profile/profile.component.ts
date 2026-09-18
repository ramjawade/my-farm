import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { FarmLookupService } from '../../core/farms/farm-lookup.service';
import { SavedFarm } from '../../map/models/map.models';
import { ProfileEditDialogComponent } from './components/profile-edit-dialog.component';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
import { SUPPORTED_LANGUAGES } from '../../core/i18n/supported-languages';
import { ToastService } from 'shared';

@Component({
  standalone: true,
  selector: 'app-profile',
  imports: [CommonModule, ProfileEditDialogComponent, TranslatePipe, ReferenceNamePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly farmLookup = inject(FarmLookupService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  // Read-only state
  readonly currentUser = this.authService.currentUser;

  // The onboarding wizard's `farmName`/`farmArea` are separate from the
  // actual saved lands drawn on the map — a farmer who skipped the wizard
  // and drew a land directly would otherwise see "Unnamed Farm" / 0 acres
  // here despite having real land data. Prefer the saved lands when any
  // exist; fall back to the onboarding fields only when there are none.
  readonly savedFarms = signal<SavedFarm[]>([]);

  async ngOnInit(): Promise<void> {
    this.savedFarms.set(await this.farmLookup.loadForCurrentUser());
  }

  readonly landSummary = computed(() => {
    const farms = this.savedFarms();
    const user = this.currentUser();
    const unit = user?.farmAreaUnit === 'acres' ? 'acres' : 'hectares';

    if (farms.length > 0) {
      const totalArea = farms.reduce(
        (sum, f) => sum + (unit === 'acres' ? f.area.acres : f.area.hectares),
        0,
      );
      return {
        name:
          farms.length === 1
            ? farms[0].name
            : this.translate.instant('profile.landsCount', { count: farms.length }),
        area: Math.round(totalArea * 100) / 100,
        unit,
      };
    }

    return {
      name: user?.farmName || this.translate.instant('profile.unnamedFarm'),
      area: user?.farmArea ?? 0,
      unit,
    };
  });

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

  /**
   * Resolves the human-readable, bilingual language label (e.g. "Marathi
   * (मराठी)") from the stored short code — fixes #190/#202: the summary
   * used to print the raw `preferredLanguage` code.
   */
  readonly preferredLanguageLabel = computed(() => {
    const code = this.currentUser()?.preferredLanguage;
    return SUPPORTED_LANGUAGES.find((lang) => lang.value === code)?.label || code || '';
  });

  openEditDialog(section: 'account' | 'agronomic' | 'land' | 'operations'): void {
    this.activeSection.set(section);
    this.showEditDialog.set(true);
  }

  deleteAgronomic(): void {
    if (confirm(this.translate.instant('profile.confirmDeleteAgronomic'))) {
      this.authService.updateProfile({
        userRole: 'Farmer',
        farmingMethod: '',
        farmSetupCompleted: false,
      });
    }
  }

  deleteLandLocation(): void {
    if (confirm(this.translate.instant('profile.confirmDeleteLand'))) {
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
    if (confirm(this.translate.instant('profile.confirmDeleteOperations'))) {
      this.authService.updateProfile({
        waterSource: '',
        irrigationType: '',
        primaryCrops: [],
        farmSetupCompleted: false,
      });
    }
  }
}
