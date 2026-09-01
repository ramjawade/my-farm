import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FarmerRegistrationService } from './farmer-registration.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-farmer-registration',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './farmer-registration.component.html',
  styleUrl: './farmer-registration.component.scss'
})
export class FarmerRegistrationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly registrationService = inject(FarmerRegistrationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSuccess = signal(false);
  readonly registeredName = signal('');

  readonly languages = [
    { value: 'English', label: 'English (English)' },
    { value: 'Hindi', label: 'Hindi (हिन्दी)' },
    { value: 'Marathi', label: 'Marathi (मराठी)' },
    { value: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { value: 'Telugu', label: 'Telugu (తెలుగు)' },
    { value: 'Tamil', label: 'Tamil (தமிழ்)' }
  ];

  readonly registrationForm: FormGroup;

  constructor() {
    this.registrationForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9-+() ]{10,15}$')]],
      email: ['', [Validators.email]],
      preferredLanguage: ['English', Validators.required]
    });
  }

  submitRegistration(): void {
    if (this.registrationForm.invalid) {
      return;
    }

    const formValues = this.registrationForm.value;
    const digitsOnly = formValues.phone.replace(/\D/g, '');
    const sanitizedPhone = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

    const registrationData = {
      fullName: formValues.fullName,
      phone: sanitizedPhone,
      email: formValues.email || undefined,
      preferredLanguage: formValues.preferredLanguage,
      userRole: 'Farmer',
      farmName: `${formValues.fullName}'s Farm`,
      farmArea: 0,
      farmAreaUnit: 'hectares' as const,
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'skipped' as const,
      location: null
    };

    const registered = this.registrationService.registerFarmer(registrationData);
    
    // Auto-login
    this.authService.login(registered);
    this.registeredName.set(registered.fullName);
    this.isSuccess.set(true);
  }

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }
}
