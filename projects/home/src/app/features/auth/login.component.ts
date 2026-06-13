import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly farmerService = inject(FarmerRegistrationService);
  private readonly router = inject(Router);

  // List of registered profiles
  readonly registeredFarmers = this.farmerService.registeredFarmers;

  // Phone & Name input states
  readonly phone = signal('');
  readonly name = signal('');
  readonly phoneError = signal('');
  readonly isNewNumber = signal(false);

  constructor() {
    // If already logged in, redirect to map
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/map']);
    }
  }

  // Quick Login
  loginAs(farmer: FarmerRegistrationData): void {
    this.authService.login(farmer);
    this.router.navigate(['/map']);
  }

  // Standard Login / Inline Registration
  onSubmitPhone(): void {
    const rawPhone = this.phone().trim();
    if (!rawPhone) {
      this.phoneError.set('Please enter your phone number.');
      return;
    }

    // Strip non-digits and keep the last 10 digits
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const phoneVal = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

    if (phoneVal.length !== 10) {
      this.phoneError.set('Please enter a valid 10-digit mobile number.');
      return;
    }

    this.phoneError.set('');

    // Look up registered farmer by comparing clean 10-digit numbers
    const registered = this.registeredFarmers();
    const found = registered.find(f => {
      const fPhoneClean = f.phone.replace(/\D/g, '');
      const fPhone10 = fPhoneClean.length > 10 ? fPhoneClean.slice(-10) : fPhoneClean;
      return fPhone10 === phoneVal;
    });

    if (found) {
      this.authService.login(found);
      this.router.navigate(['/map']);
    } else {
      if (!this.isNewNumber()) {
        // Switch to inline registration mode
        this.isNewNumber.set(true);
        return;
      }

      // Check name validation
      const nameVal = this.name().trim();
      if (!nameVal || nameVal.length < 3) {
        this.phoneError.set('Please enter your full name (minimum 3 characters).');
        return;
      }

      // Register new farmer on the fly
      const newFarmer = this.farmerService.registerFarmer({
        fullName: nameVal,
        phone: phoneVal,
        preferredLanguage: 'English',
        userRole: 'Farmer',
        farmName: `${nameVal}'s Farm`,
        farmArea: 0,
        farmAreaUnit: 'hectares',
        primaryCrops: [],
        waterSource: 'Rainfed',
        irrigationType: 'Manual',
        farmingMethod: 'Organic',
        locationType: 'skipped',
        location: null
      });

      this.authService.login(newFarmer);
      this.router.navigate(['/map']);
    }
  }

  resetOnNumberChange(): void {
    this.isNewNumber.set(false);
    this.phoneError.set('');
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}
