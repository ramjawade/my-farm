import { I18n } from '../../../core/i18n/i18n.service';
import {
  Component,
  inject,
  signal,
  computed,
  effect,
  input,
  model,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmerRegistrationData } from '../../farmer-registration/farmer-registration.models';
import { LatLngPoint } from '../../../map/models/map.models';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { getPolygonCentroid } from '../../../map/farm-draw/farm-area.utils';
import { MapComponent } from '../../../map/map';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/supported-languages';
import * as L from 'leaflet';
import { ToastService } from 'shared';

@Component({
  standalone: true,
  selector: 'app-profile-edit-dialog',
  imports: [CommonModule, FormsModule, MapComponent, TranslatePipe],
  templateUrl: './profile-edit-dialog.component.html',
  styleUrl: './profile-edit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEditDialogComponent {
  private readonly i18n = inject(I18n);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly workflowService = inject(WorkflowStateService);
  readonly drawService = inject(FarmDrawService);

  // Inputs using modern Signal API
  readonly section = input.required<'account' | 'agronomic' | 'land' | 'operations' | 'setup'>();
  readonly show = model(false);

  // Read-only profile state
  readonly currentUser = this.authService.currentUser;

  // Dialog Form Signals
  readonly editFullName = signal('');
  readonly editPhone = signal('');
  readonly editEmail = signal('');
  readonly editPreferredLanguage = signal('');
  readonly editUserRole = signal('');
  readonly editFarmName = signal('');
  readonly editFarmArea = signal(0);
  readonly editFarmAreaUnit = signal<'acres' | 'hectares'>('hectares');
  readonly editWaterSource = signal('Rainfed');
  readonly editIrrigationType = signal('Drip');
  readonly editFarmingMethod = signal('Organic');
  readonly editState = signal('');
  readonly editDistrict = signal('');
  readonly editVillage = signal('');
  readonly editPincode = signal('');
  readonly selectedCrops = signal<string[]>([]);

  readonly saving = signal(false);
  readonly saveError = signal('');

  // Geocentric coordinates state
  readonly locationMethod = signal<'map' | 'manual'>('map');
  readonly mapMode = signal<'pin' | 'draw'>('pin');
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);

  readonly languages = SUPPORTED_LANGUAGES;

  /** Translation key for a crop, role, method, water source or irrigation option. */
  optionKey(value: string): string {
    return 'profileEdit.options.' + value.replace(/\s+/g, '');
  }

  readonly cropOptions = [
    { value: 'Wheat', label: 'Wheat', icon: 'bi-flower2', color: 'var(--mf-sun)' },
    { value: 'Rice', label: 'Rice', icon: 'bi-water', color: 'var(--mf-sky)' },
    { value: 'Corn', label: 'Corn', icon: 'bi-sun-fill', color: 'var(--mf-sun)' },
    { value: 'Cotton', label: 'Cotton', icon: 'bi-cloud-fill', color: 'var(--mf-muted)' },
    {
      value: 'Sugarcane',
      label: 'Sugarcane',
      icon: 'bi-distribute-vertical',
      color: 'var(--mf-leaf)',
    },
    { value: 'Soybeans', label: 'Soybeans', icon: 'bi-record-circle', color: 'var(--mf-fg)' },
    { value: 'Mustard', label: 'Mustard', icon: 'bi-brightness-high', color: 'var(--mf-sun)' },
    { value: 'Vegetables', label: 'Vegetables', icon: 'bi-basket', color: 'var(--mf-rose)' },
    { value: 'Fruits', label: 'Fruits', icon: 'bi-apple', color: 'var(--mf-rose)' },
  ];

  readonly waterSourceOptions = [
    { value: 'Borewell', label: 'Borewell', icon: 'bi-box-arrow-down', color: 'var(--mf-muted)' },
    { value: 'Canal', label: 'Canal', icon: 'bi-water', color: 'var(--mf-sky)' },
    { value: 'River', label: 'River', icon: 'bi-droplet-fill', color: 'var(--mf-sky)' },
    { value: 'Farm Pond', label: 'Farm Pond', icon: 'bi-moisture', color: 'var(--mf-teal)' },
    { value: 'Rainfed', label: 'Rainfed', icon: 'bi-cloud-rain-fill', color: 'var(--mf-fg)' },
  ];

  readonly irrigationTypeOptions = [
    { value: 'Drip', label: 'Drip', icon: 'bi-droplet-half', color: 'var(--mf-teal)' },
    {
      value: 'Sprinkler',
      label: 'Sprinkler',
      icon: 'bi-cloud-drizzle-fill',
      color: 'var(--mf-fg)',
    },
    { value: 'Flood', label: 'Flood', icon: 'bi-water', color: 'var(--mf-sky)' },
    { value: 'Manual', label: 'Manual', icon: 'bi-person-fill', color: 'var(--mf-sun)' },
  ];

  readonly farmingMethods = [
    { value: 'Organic', label: 'Organic', icon: 'bi-leaf-fill', color: 'var(--mf-leaf)' },
    {
      value: 'Conventional',
      label: 'Conventional',
      icon: 'bi-gear-fill',
      color: 'var(--mf-muted)',
    },
    {
      value: 'Conservation Farming',
      label: 'Conservation Farming',
      icon: 'bi-shield-shaded',
      color: 'var(--mf-teal)',
    },
    {
      value: 'Natural Farming',
      label: 'Natural Farming',
      icon: 'bi-sun-fill',
      color: 'var(--mf-sun)',
    },
  ];

  readonly roleOptions = [
    { value: 'Farmer', label: 'Farmer', icon: 'bi-person-badge-fill', color: 'var(--mf-leaf)' },
    {
      value: 'Farm Owner',
      label: 'Farm Owner',
      icon: 'bi-house-heart-fill',
      color: 'var(--mf-sky)',
    },
    {
      value: 'Agronomist',
      label: 'Agronomist',
      icon: 'bi-clipboard-pulse',
      color: 'var(--mf-sun)',
    },
    {
      value: 'Farm Worker',
      label: 'Farm Worker',
      icon: 'bi-wrench-adjustable',
      color: 'var(--mf-fg)',
    },
    { value: 'Student', label: 'Student', icon: 'bi-mortarboard-fill', color: 'var(--mf-teal)' },
    { value: 'Researcher', label: 'Researcher', icon: 'bi-search', color: 'var(--mf-rose)' },
    { value: 'Gardener', label: 'Gardener', icon: 'bi-flower1', color: 'var(--mf-leaf)' },
  ];

  // Leaflet map instances
  private map: L.Map | undefined;
  private marker: L.Marker | undefined;

  // Validation Computeds
  readonly isNamePatternValid = computed(() => {
    const name = this.editFullName();
    // 255 matches the backend's full_name column limit (FarmerBase.full_name).
    return !name || (name.trim().length >= 3 && name.length <= 255);
  });

  readonly isEmailPatternValid = computed(() => {
    const email = this.editEmail();
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });

  readonly isAccountValid = computed(() => {
    const name = this.editFullName();
    const email = this.editEmail();

    const isNameValid = name && name.trim().length >= 3;
    const isEmailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    return !!(isNameValid && isEmailValid);
  });

  readonly isLandValid = computed(() => {
    const farmName = this.editFarmName();
    const farmArea = this.editFarmArea();

    const isFarmNameValid = farmName && farmName.trim().length >= 2;
    const isAreaValid = farmArea !== null && farmArea > 0;

    if (!isFarmNameValid || !isAreaValid) {
      return false;
    }

    if (this.locationMethod() === 'map') {
      return this.latitude() !== null && this.longitude() !== null;
    } else {
      const state = this.editState();
      const district = this.editDistrict();
      const village = this.editVillage();
      const pincode = this.editPincode();

      return !!(
        state &&
        state.trim().length >= 2 &&
        district &&
        district.trim().length >= 2 &&
        village &&
        village.trim().length >= 2 &&
        pincode &&
        pincode.trim().length >= 5
      );
    }
  });

  readonly isOperationsValid = computed(() => {
    return this.selectedCrops().length > 0;
  });

  constructor() {
    // Reactively monitor show & section state changes to initialize map / drawing state
    effect(
      () => {
        const showVal = this.show();
        const secVal = this.section();
        if (showVal) {
          this.initFormValues();
          if (secVal === 'land') {
            this.drawService.cancelDrawing();
            this.mapMode.set('pin');
          }
        } else {
          this.cleanupMap();
          this.drawService.cancelDrawing();
        }
      },
      { allowSignalWrites: true },
    );

    // Effect to handle polygon drawing completion
    effect(() => {
      const status = this.drawService.status();
      if (status === 'completed' && this.section() === 'land' && this.mapMode() === 'draw') {
        const points = this.drawService.points();
        const areaResult = this.drawService.area();
        const centroid = getPolygonCentroid(points);

        if (centroid) {
          const roundedLat = Math.round(centroid.lat * 100000) / 100000;
          const roundedLng = Math.round(centroid.lng * 100000) / 100000;

          this.latitude.set(roundedLat);
          this.longitude.set(roundedLng);

          this.reverseGeocode(roundedLat, roundedLng);
        }

        if (areaResult) {
          const hectaresVal = Math.round(areaResult.hectares * 100) / 100;
          this.editFarmArea.set(hectaresVal);
          this.editFarmAreaUnit.set('hectares');
        }
      }
    });
  }

  private initFormValues(): void {
    this.saveError.set('');
    const user = this.currentUser();
    if (user) {
      this.editFullName.set(user.fullName);
      this.editPhone.set(user.phone || '');
      this.editEmail.set(user.email || '');
      this.editPreferredLanguage.set(user.preferredLanguage);
      this.editUserRole.set(user.userRole);
      this.editFarmName.set(user.farmName);
      this.editFarmArea.set(user.farmArea);
      this.editFarmAreaUnit.set(user.farmAreaUnit);
      this.editWaterSource.set(user.waterSource || 'Rainfed');
      this.editIrrigationType.set(user.irrigationType || 'Drip');
      this.editFarmingMethod.set(user.farmingMethod || 'Organic');
      this.editState.set(user.state || '');
      this.editDistrict.set(user.district || '');
      this.editVillage.set(user.village || '');
      this.editPincode.set(user.pincode || '');

      const type = user.locationType === 'skipped' ? 'map' : user.locationType;
      this.locationMethod.set(type);

      if (user.location) {
        this.latitude.set(user.location.lat);
        this.longitude.set(user.location.lng);
      } else {
        this.latitude.set(null);
        this.longitude.set(null);
      }

      this.selectedCrops.set([...(user.primaryCrops || [])]);
    }
  }

  setLocationMethod(method: 'map' | 'manual'): void {
    this.locationMethod.set(method);
    if (method === 'manual') {
      this.cleanupMap();
      this.drawService.cancelDrawing();
    } else {
      this.mapMode.set('pin');
    }
  }

  setMapMode(mode: 'pin' | 'draw'): void {
    this.mapMode.set(mode);
    if (mode === 'draw') {
      if (this.marker && this.map) {
        this.map.removeLayer(this.marker);
        this.marker = undefined;
      }
      this.latitude.set(null);
      this.longitude.set(null);
      this.drawService.startDrawing();
    } else {
      this.drawService.cancelDrawing();
    }
  }

  toggleCrop(crop: string): void {
    const current = this.selectedCrops();
    if (current.includes(crop)) {
      this.selectedCrops.set(current.filter((c) => c !== crop));
    } else {
      this.selectedCrops.set([...current, crop]);
    }
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    if (this.latitude() !== null && this.longitude() !== null) {
      this.updateMarker(this.latitude()!, this.longitude()!);
    }
  }

  updateMarker(lat: number, lng: number): void {
    if (!this.map) return;

    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;

    this.latitude.set(roundedLat);
    this.longitude.set(roundedLng);

    if (this.marker) {
      this.marker.setLatLng([roundedLat, roundedLng]);
    } else {
      this.marker = L.marker([roundedLat, roundedLng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        if (this.marker) {
          const pos = this.marker.getLatLng();
          this.updateMarker(pos.lat, pos.lng);
        }
      });
    }

    this.map.panTo([roundedLat, roundedLng]);
    this.reverseGeocode(roundedLat, roundedLng);
  }

  private reverseGeocode(lat: number, lng: number): void {
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data && data.address) {
          const addr = data.address;
          this.editState.set(addr.state || '');
          this.editDistrict.set(addr.county || addr.district || addr.state_district || '');
          this.editVillage.set(addr.village || addr.town || addr.suburb || addr.city || '');
          this.editPincode.set(addr.postcode || '');
        }
      })
      .catch((err) => {
        console.error('OSM Reverse geocoding failed', err);
      });
  }

  private cleanupMap(): void {
    if (this.marker && this.map) {
      this.marker.off('dragend');
      this.map.removeLayer(this.marker);
    }
    this.marker = undefined;
    this.map = undefined;
  }

  async save(): Promise<void> {
    const user = this.currentUser();
    if (!user || this.saving()) return;

    const secVal = this.section();
    const updates: Partial<FarmerRegistrationData> = {};

    if (secVal === 'account') {
      updates.fullName = this.editFullName();
      updates.email = this.editEmail();
      updates.preferredLanguage = this.editPreferredLanguage();
    } else if (secVal === 'agronomic') {
      updates.userRole = this.editUserRole();
      updates.farmingMethod = this.editFarmingMethod();
    } else if (secVal === 'land') {
      updates.farmName = this.editFarmName();
      updates.farmArea = Number(this.editFarmArea());
      updates.farmAreaUnit = this.editFarmAreaUnit();
      updates.locationType = this.locationMethod();
      updates.state = this.editState();
      updates.district = this.editDistrict();
      updates.village = this.editVillage();
      updates.pincode = this.editPincode();

      if (this.locationMethod() === 'map' && this.latitude() && this.longitude()) {
        updates.location = {
          lat: this.latitude()!,
          lng: this.longitude()!,
        };
      } else if (this.locationMethod() === 'manual') {
        updates.location = null;
      }
    } else if (secVal === 'operations') {
      updates.waterSource = this.editWaterSource();
      updates.irrigationType = this.editIrrigationType();
      updates.primaryCrops = this.selectedCrops();
    } else if (secVal === 'setup') {
      updates.waterSource = this.editWaterSource();
      updates.irrigationType = this.editIrrigationType();
      updates.farmingMethod = this.editFarmingMethod();
      updates.farmSetupCompleted = true;
    }

    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.authService.updateProfile(updates);
    } catch (error) {
      console.error('Failed to save profile', error);
      this.saveError.set(this.i18n.t('common.saveFailed'));
      return;
    } finally {
      this.saving.set(false);
    }

    // Mark workflow phases complete
    if (secVal === 'land' && updates.village && updates.state) {
      this.workflowService.markPhaseComplete('land');
    }
    if (secVal === 'setup') {
      this.workflowService.markPhaseComplete('location');
    }

    this.toast.success(this.i18n.t('profileEdit.updated'));
    this.close();
  }

  close(): void {
    this.show.set(false);
  }
}
