import {
  Component,
  OnDestroy,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';

import { FarmerRegistrationService } from './farmer-registration.service';
import { LatLngPoint } from '../../map/models/map.models';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { getPolygonCentroid } from '../../map/farm-draw/farm-area.utils';
import { MapComponent } from '../../map/map';

@Component({
  standalone: true,
  selector: 'app-farmer-registration',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MapComponent],
  templateUrl: './farmer-registration.component.html',
  styleUrl: './farmer-registration.component.scss'
})
export class FarmerRegistrationComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly registrationService = inject(FarmerRegistrationService);
  private readonly router = inject(Router);

  // Map elements
  private map?: L.Map;
  private marker?: L.Marker;
  
  // Polygon drawing service
  readonly drawService = inject(FarmDrawService);

  // Wizard state signals
  readonly currentStep = signal<number>(1);
  readonly isSuccess = signal<boolean>(false);
  readonly registeredName = signal<string>('');

  // Step 3 (Crops & Location) signals
  readonly selectedCrops = signal<string[]>([]);
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly locationMethod = signal<'map' | 'manual'>('map');
  readonly isStep3Skipped = signal<boolean>(false);
  readonly mapMode = signal<'pin' | 'draw'>('pin');


  // Constant arrays
  readonly languages = [
    { value: 'English', label: 'English (English)' },
    { value: 'Hindi', label: 'Hindi (हिन्दी)' },
    { value: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { value: 'Telugu', label: 'Telugu (తెలుగు)' },
    { value: 'Marathi', label: 'Marathi (मराठी)' },
    { value: 'Tamil', label: 'Tamil (தமிழ்)' },
    { value: 'Kannada', label: 'Kannada (ಕನ್ನಡ)' },
    { value: 'Bengali', label: 'Bengali (বাংলা)' },
    { value: 'Spanish', label: 'Spanish (Español)' }
  ];
  readonly cropOptions = [
    { value: 'Wheat', label: 'Wheat', icon: 'bi-flower2', color: '#d69e2e' },
    { value: 'Rice', label: 'Rice', icon: 'bi-water', color: '#3182ce' },
    { value: 'Corn', label: 'Corn', icon: 'bi-sun-fill', color: '#ecc94b' },
    { value: 'Cotton', label: 'Cotton', icon: 'bi-cloud-fill', color: '#a0aec0' },
    { value: 'Sugarcane', label: 'Sugarcane', icon: 'bi-distribute-vertical', color: '#38a169' },
    { value: 'Soybeans', label: 'Soybeans', icon: 'bi-record-circle', color: '#4a5568' },
    { value: 'Mustard', label: 'Mustard', icon: 'bi-brightness-high', color: '#d69e2e' },
    { value: 'Vegetables', label: 'Vegetables', icon: 'bi-basket', color: '#e53e3e' },
    { value: 'Fruits', label: 'Fruits', icon: 'bi-apple', color: '#e53e3e' },
    { value: 'Other', label: 'Other', icon: 'bi-grid-fill', color: '#4a5568' }
  ];
  readonly waterSourceOptions = [
    { value: 'Borewell', label: 'Borewell', icon: 'bi-box-arrow-down', color: '#718096' },
    { value: 'Canal', label: 'Canal', icon: 'bi-water', color: '#2b6cb0' },
    { value: 'River', label: 'River', icon: 'bi-droplet-fill', color: '#3182ce' },
    { value: 'Farm Pond', label: 'Farm Pond', icon: 'bi-moisture', color: '#319795' },
    { value: 'Rainfed', label: 'Rainfed', icon: 'bi-cloud-rain-fill', color: '#4a5568' }
  ];
  readonly irrigationTypeOptions = [
    { value: 'Drip', label: 'Drip', icon: 'bi-droplet-half', color: '#319795' },
    { value: 'Sprinkler', label: 'Sprinkler', icon: 'bi-cloud-drizzle-fill', color: '#4a5568' },
    { value: 'Flood', label: 'Flood', icon: 'bi-water', color: '#3182ce' },
    { value: 'Manual', label: 'Manual', icon: 'bi-person-fill', color: '#d69e2e' }
  ];
  readonly farmingMethods = [
    { value: 'Organic', label: 'Organic', icon: 'bi-leaf-fill', color: '#38a169' },
    { value: 'Conventional', label: 'Conventional', icon: 'bi-gear-fill', color: '#718096' },
    { value: 'Conservation Farming', label: 'Conservation Farming', icon: 'bi-shield-shaded', color: '#319795' },
    { value: 'Natural Farming', label: 'Natural Farming', icon: 'bi-sun-fill', color: '#ecc94b' }
  ];
  readonly roleOptions = [
    { value: 'Farmer', label: 'Farmer', icon: 'bi-person-badge-fill', color: '#2a6f47', subtext: 'Manages fields & crops' },
    { value: 'Farm Owner', label: 'Farm Owner', icon: 'bi-house-heart-fill', color: '#2b6cb0', subtext: 'Landholder & partner' },
    { value: 'Agronomist', label: 'Agronomist', icon: 'bi-clipboard-pulse', color: '#d69e2e', subtext: 'Crop health expert' },
    { value: 'Farm Worker', label: 'Farm Worker', icon: 'bi-wrench-adjustable', color: '#4a5568', subtext: 'Harvests & field work' },
    { value: 'Student', label: 'Student', icon: 'bi-mortarboard-fill', color: '#319795', subtext: 'Agri studies learner' },
    { value: 'Researcher', label: 'Researcher', icon: 'bi-search', color: '#e53e3e', subtext: 'Crop innovation science' },
    { value: 'Gardener', label: 'Gardener', icon: 'bi-flower1', color: '#38a169', subtext: 'Backyard & small patches' }
  ];

  // Form definition
  readonly registrationForm: FormGroup;

  constructor() {
    this.registrationForm = this.fb.group({
      // Step 1: Personal
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9-+() ]{10,15}$')]],
      email: ['', [Validators.email]],
      preferredLanguage: ['English', Validators.required],

      // Step 2: Farm Info
      userRole: ['Farmer', Validators.required],
      farmName: ['', [Validators.required, Validators.minLength(2)]],
      farmArea: ['', [Validators.required, Validators.min(0.01)]],
      farmAreaUnit: ['hectares', Validators.required],

      // Step 3: Crops & Practices
      locationType: ['map', Validators.required],
      state: [''],
      district: [''],
      village: [''],
      pincode: [''],
      waterSource: ['Rainfed', Validators.required],
      irrigationType: ['Drip', Validators.required],
      farmingMethod: ['Organic', Validators.required]
    });

    // In Angular 20, we can use an effect to listen to step changes
    // When step 3 becomes active, we must invalidate map size to render Leaflet correctly
    effect(() => {
      const step = this.currentStep();
      if (step === 3 && this.map) {
        // Run after DOM has updated the step container display property
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
          }
        }, 100);
      }
    });

    // Effect to handle polygon drawing completion
    effect(() => {
      const status = this.drawService.status();
      if (status === 'completed') {
        const points = this.drawService.points();
        const areaResult = this.drawService.area();
        const centroid = getPolygonCentroid(points);

        if (centroid) {
          const roundedLat = Math.round(centroid.lat * 100000) / 100000;
          const roundedLng = Math.round(centroid.lng * 100000) / 100000;

          this.latitude.set(roundedLat);
          this.longitude.set(roundedLng);

          // Reverse geocode centroid to auto-populate address fields
          this.reverseGeocode(roundedLat, roundedLng);
        }

        if (this.mapMode() === 'draw' && areaResult) {
          // Auto populate the farm area form input field in hectares
          const hectaresVal = Math.round(areaResult.hectares * 100) / 100;
          this.registrationForm.get('farmArea')?.setValue(hectaresVal);
          this.registrationForm.get('farmAreaUnit')?.setValue('hectares');
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.marker) {
      this.marker.off('dragend');
    }
  }

  // --- Step Navigation Logic ---
  nextStep(): void {
    if (this.currentStep() === 1 && this.isStep1Valid()) {
      this.currentStep.set(2);
    } else if (this.currentStep() === 2 && this.isStep2Valid()) {
      this.currentStep.set(3);
    } else if (this.currentStep() === 3 && this.isStep3Valid()) {
      this.isStep3Skipped.set(false);
      this.currentStep.set(4);
    } else if (this.currentStep() === 4 && this.isStep4Valid()) {
      this.currentStep.set(5);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  skipStep3(): void {
    this.isStep3Skipped.set(true);
    // Clear step 3/4 inputs for consistency when skipped
    this.selectedCrops.set([]);
    this.latitude.set(null);
    this.longitude.set(null);
    this.registrationForm.get('state')?.setValue('');
    this.registrationForm.get('district')?.setValue('');
    this.registrationForm.get('village')?.setValue('');
    this.registrationForm.get('pincode')?.setValue('');
    
    // Reset drawing state
    this.drawService.cancelDrawing();

    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }
    this.currentStep.set(5); // Skip straight to step 5 (Review)
  }

  setMapMode(mode: 'pin' | 'draw'): void {
    this.mapMode.set(mode);
    if (mode === 'draw') {
      // Remove point pin marker if any
      if (this.marker && this.map) {
        this.map.removeLayer(this.marker);
        this.marker = undefined;
      }
      this.latitude.set(null);
      this.longitude.set(null);
      
      // Start polygon drawing
      this.drawService.startDrawing();
    } else {
      // Cancel drawing
      this.drawService.cancelDrawing();
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep()) {
      this.currentStep.set(step);
    } else if (step === 2 && this.isStep1Valid()) {
      this.currentStep.set(step);
    } else if (step === 3 && this.isStep1Valid() && this.isStep2Valid()) {
      this.currentStep.set(step);
    } else if (step === 4 && this.isStep1Valid() && this.isStep2Valid() && this.isStep3Valid()) {
      this.currentStep.set(step);
    } else if (step === 5 && this.isStep1Valid() && this.isStep2Valid() && this.isStep3Valid() && this.isStep4Valid()) {
      this.currentStep.set(step);
    }
  }

  // --- Form Validation Helpers ---
  isStep1Valid(): boolean {
    const name = this.registrationForm.get('fullName');
    const phone = this.registrationForm.get('phone');
    const email = this.registrationForm.get('email');
    const lang = this.registrationForm.get('preferredLanguage');

    return !!(name?.valid && phone?.valid && email?.valid && lang?.valid);
  }

  isStep2Valid(): boolean {
    const userRole = this.registrationForm.get('userRole');
    const farmingMethod = this.registrationForm.get('farmingMethod');
    return !!(userRole?.valid && farmingMethod?.valid);
  }

  setLocationMethod(method: 'map' | 'manual'): void {
    this.isStep3Skipped.set(false);
    this.locationMethod.set(method);
    this.registrationForm.get('locationType')?.setValue(method);
    
    const stateCtrl = this.registrationForm.get('state');
    const distCtrl = this.registrationForm.get('district');
    const villCtrl = this.registrationForm.get('village');
    const pinCtrl = this.registrationForm.get('pincode');

    if (method === 'manual') {
      stateCtrl?.setValidators([Validators.required, Validators.minLength(2)]);
      distCtrl?.setValidators([Validators.required, Validators.minLength(2)]);
      villCtrl?.setValidators([Validators.required, Validators.minLength(2)]);
      pinCtrl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      stateCtrl?.clearValidators();
      distCtrl?.clearValidators();
      villCtrl?.clearValidators();
      pinCtrl?.clearValidators();
    }

    stateCtrl?.updateValueAndValidity();
    distCtrl?.updateValueAndValidity();
    villCtrl?.updateValueAndValidity();
    pinCtrl?.updateValueAndValidity();
  }

  isStep3Valid(): boolean {
    if (this.isStep3Skipped()) {
      return true;
    }

    const farmArea = this.registrationForm.get('farmArea');
    const farmAreaUnit = this.registrationForm.get('farmAreaUnit');
    if (!farmArea?.valid || !farmAreaUnit?.valid) {
      return false;
    }

    if (this.locationMethod() === 'map') {
      return this.latitude() !== null && this.longitude() !== null;
    } else {
      const state = this.registrationForm.get('state');
      const district = this.registrationForm.get('district');
      const village = this.registrationForm.get('village');
      const pincode = this.registrationForm.get('pincode');
      return !!(state?.valid && district?.valid && village?.valid && pincode?.valid);
    }
  }

  isStep4Valid(): boolean {
    if (this.isStep3Skipped()) {
      return true;
    }
    return this.selectedCrops().length > 0;
  }

  // --- Crops Selection logic ---
  toggleCrop(crop: string): void {
    this.isStep3Skipped.set(false);
    const current = this.selectedCrops();
    if (current.includes(crop)) {
      this.selectedCrops.set(current.filter(c => c !== crop));
    } else {
      this.selectedCrops.set([...current, crop]);
    }
  }

  // --- Leaflet Map Logic ---
  onMapReady(map: L.Map): void {
    this.map = map;
  }

  updateMarker(lat: number, lng: number): void {
    if (!this.map) {
      return;
    }

    this.isStep3Skipped.set(false);

    // Keep coordinates with 5 decimal places for precision (~1m)
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
          const position = this.marker.getLatLng();
          this.updateMarker(position.lat, position.lng);
        }
      });
    }

    this.map.panTo([roundedLat, roundedLng]);

    // Reverse geocode to auto-populate address controls
    this.reverseGeocode(roundedLat, roundedLng);
  }

  reverseGeocode(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          const addr = data.address;
          const state = addr.state || '';
          const district = addr.county || addr.district || addr.state_district || '';
          const village = addr.village || addr.town || addr.suburb || addr.city || addr.municipality || addr.neighbourhood || '';
          const postcode = addr.postcode || '';

          this.registrationForm.patchValue({
            state: state,
            district: district,
            village: village,
            pincode: postcode
          });
        }
      })
      .catch(err => {
        console.error('Reverse geocoding failed', err);
      });
  }

  resetMapView(): void {
    if (this.map) {
      this.map.setView([20.5937, 78.9629], 5);
    }
  }

  // --- Submission ---
  submitRegistration(): void {
    if (this.registrationForm.invalid || !this.isStep3Valid() || !this.isStep4Valid()) {
      return;
    }

    const formValues = this.registrationForm.value;
    const isSkipped = this.isStep3Skipped();
    const hasMap = !isSkipped && this.locationMethod() === 'map';
    const locationPoint: LatLngPoint | null = hasMap ? {
      lat: this.latitude()!,
      lng: this.longitude()!
    } : null;

    const registrationData = {
      fullName: formValues.fullName,
      phone: formValues.phone,
      email: formValues.email || undefined,
      preferredLanguage: formValues.preferredLanguage,
      userRole: formValues.userRole,
      farmName: formValues.farmName,
      farmArea: Number(formValues.farmArea),
      farmAreaUnit: formValues.farmAreaUnit as 'acres' | 'hectares',
      primaryCrops: isSkipped ? [] : this.selectedCrops(),
      waterSource: isSkipped ? 'Skipped' : formValues.waterSource,
      irrigationType: isSkipped ? 'Skipped' : formValues.irrigationType,
      farmingMethod: isSkipped ? 'Skipped' : formValues.farmingMethod,
      locationType: (isSkipped ? 'skipped' : this.locationMethod()) as 'map' | 'manual' | 'skipped',
      state: !isSkipped ? formValues.state || undefined : undefined,
      district: !isSkipped ? formValues.district || undefined : undefined,
      village: !isSkipped ? formValues.village || undefined : undefined,
      pincode: !isSkipped ? formValues.pincode || undefined : undefined,
      location: locationPoint
    };

    const registered = this.registrationService.registerFarmer(registrationData);
    
    // Set success signals and switch UI state
    this.registeredName.set(registered.fullName);
    this.isSuccess.set(true);
  }

  resetForm(): void {
    this.registrationForm.reset({
      preferredLanguage: 'English',
      userRole: 'Farmer',
      locationType: 'map',
      farmAreaUnit: 'hectares',
      waterSource: 'Rainfed',
      irrigationType: 'Drip',
      farmingMethod: 'Organic'
    });

    this.isStep3Skipped.set(false);
    this.locationMethod.set('map');
    this.mapMode.set('pin');
    this.drawService.cancelDrawing();
    this.selectedCrops.set([]);
    this.latitude.set(null);
    this.longitude.set(null);
    
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = undefined;
    }

    if (this.map) {
      this.map.setView([20.5937, 78.9629], 5);
    }

    this.isSuccess.set(false);
    this.currentStep.set(1);
  }

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }
}
