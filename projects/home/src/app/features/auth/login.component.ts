import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { hashPin, verifyPin } from '../../core/auth/pin-hash.util';

type LoginStep = 'phone' | 'pin' | 'setupPin' | 'register';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly farmerService = inject(FarmerRegistrationService);
  private readonly router = inject(Router);

  readonly step = signal<LoginStep>('phone');
  readonly phone = signal('');
  readonly name = signal('');
  readonly pin = signal('');
  readonly confirmPin = signal('');
  readonly errorMessage = signal('');

  private matchedFarmer: FarmerRegistrationData | null = null;

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/map']);
    }
  }

  onSubmitPhone(): void {
    const rawPhone = this.phone().trim();
    if (!rawPhone) {
      this.errorMessage.set('Please enter your phone number.');
      return;
    }

    const digitsOnly = rawPhone.replace(/\D/g, '');
    const phoneVal = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

    if (phoneVal.length !== 10) {
      this.errorMessage.set('Please enter a valid 10-digit mobile number.');
      return;
    }

    this.errorMessage.set('');
    this.phone.set(phoneVal);

    const registered = this.farmerService.registeredFarmers();
    const found = registered.find((f) => {
      const fPhoneClean = f.phone.replace(/\D/g, '');
      const fPhone10 = fPhoneClean.length > 10 ? fPhoneClean.slice(-10) : fPhoneClean;
      return fPhone10 === phoneVal;
    });

    if (found) {
      this.matchedFarmer = found;
      this.step.set(found.pinHash ? 'pin' : 'setupPin');
    } else {
      this.step.set('register');
    }
  }

  async onSubmitPin(): Promise<void> {
    const pinVal = this.pin().trim();
    if (!/^[0-9]{4,6}$/.test(pinVal)) {
      this.errorMessage.set('Please enter a valid 4-6 digit PIN.');
      return;
    }

    if (!this.matchedFarmer?.pinHash) {
      this.errorMessage.set('Something went wrong. Please try again.');
      return;
    }

    const isValid = await verifyPin(pinVal, this.matchedFarmer.pinHash);
    if (!isValid) {
      this.errorMessage.set('Incorrect PIN. Please try again.');
      return;
    }

    this.errorMessage.set('');
    this.authService.login(this.matchedFarmer);
    this.router.navigate(['/map']);
  }

  async onSubmitPinSetup(): Promise<void> {
    const pinVal = this.pin().trim();
    const confirmVal = this.confirmPin().trim();

    if (!/^[0-9]{4,6}$/.test(pinVal)) {
      this.errorMessage.set('Please enter a valid 4-6 digit PIN.');
      return;
    }
    if (pinVal !== confirmVal) {
      this.errorMessage.set('PINs do not match.');
      return;
    }

    if (!this.matchedFarmer) {
      this.errorMessage.set('Something went wrong. Please try again.');
      return;
    }

    this.errorMessage.set('');
    const pinHash = await hashPin(pinVal);
    const updated = this.farmerService.updateFarmer(this.matchedFarmer.id, { pinHash });
    if (updated) {
      this.authService.login(updated);
      this.router.navigate(['/map']);
    }
  }

  async onSubmitRegister(): Promise<void> {
    const nameVal = this.name().trim();
    const pinVal = this.pin().trim();
    const confirmVal = this.confirmPin().trim();

    if (!nameVal || nameVal.length < 3) {
      this.errorMessage.set('Please enter your full name (minimum 3 characters).');
      return;
    }
    if (!/^[0-9]{4,6}$/.test(pinVal)) {
      this.errorMessage.set('Please enter a valid 4-6 digit PIN.');
      return;
    }
    if (pinVal !== confirmVal) {
      this.errorMessage.set('PINs do not match.');
      return;
    }

    this.errorMessage.set('');
    const pinHash = await hashPin(pinVal);

    const newFarmer = this.farmerService.registerFarmer({
      fullName: nameVal,
      phone: this.phone(),
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
      location: null,
      pinHash,
    });

    this.authService.login(newFarmer);
    this.router.navigate(['/map']);
  }

  resetToPhoneStep(): void {
    this.step.set('phone');
    this.pin.set('');
    this.confirmPin.set('');
    this.name.set('');
    this.errorMessage.set('');
    this.matchedFarmer = null;
  }
}
