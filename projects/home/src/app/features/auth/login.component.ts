import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SessionAuthService } from '../../core/auth/session-auth.service';
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
  private readonly sessionAuth = inject(SessionAuthService);
  private readonly farmerService = inject(FarmerRegistrationService);
  private readonly router = inject(Router);

  readonly step = signal<LoginStep>('phone');
  readonly phone = signal('');
  readonly name = signal('');
  readonly pin = signal('');
  readonly confirmPin = signal('');
  readonly errorMessage = signal('');

  private matchedFarmer: FarmerRegistrationData | null = null;

  /** True once the backend has confirmed this phone maps to a real account
   * — the PIN step then verifies against `/auth/session`, not a local hash. */
  private backendAccount = false;

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/map']);
    }
  }

  async onSubmitPhone(): Promise<void> {
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

    this.backendAccount = false;
    this.matchedFarmer = null;

    // Ask the backend first (issue #45). If it's reachable its answer wins;
    // if not, fall back to whatever this device has locally so the app
    // still works offline / against LocalStorageService.
    const existsRemotely = await this.sessionAuth.phoneExists(phoneVal);
    if (existsRemotely === true) {
      this.backendAccount = true;
      this.step.set('pin');
      return;
    }
    if (existsRemotely === false) {
      this.step.set('register');
      return;
    }

    const found = await this.farmerService.findByPhone(phoneVal);
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

    if (this.backendAccount) {
      try {
        const session = await this.sessionAuth.createSession(this.phone(), pinVal);
        if (!session) {
          this.errorMessage.set('Incorrect PIN. Please try again.');
          return;
        }
        this.errorMessage.set('');
        this.farmerService.upsertFarmer(session.farmer);
        this.authService.login(session.farmer, session.token);
        this.router.navigate(['/map']);
        return;
      } catch {
        this.errorMessage.set('Could not reach the server. Please try again.');
        return;
      }
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
    const updated = await this.farmerService.updateFarmer(this.matchedFarmer.id, { pinHash });
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

    // Backend-first (issue #45): register there and take the session JWT it
    // returns. Fall back to a local-only account if the backend is
    // unreachable, so onboarding still works offline.
    try {
      const result = await this.sessionAuth.register({
        phone: this.phone(),
        fullName: nameVal,
        pin: pinVal,
      });
      if (result === 'phone-taken') {
        this.backendAccount = true;
        this.step.set('pin');
        this.pin.set('');
        this.confirmPin.set('');
        this.errorMessage.set('That number is already registered. Enter your PIN to sign in.');
        return;
      }
      this.farmerService.upsertFarmer(result.farmer);
      this.authService.login(result.farmer, result.token);
      this.router.navigate(['/map']);
      return;
    } catch {
      // Offline / backend down — create the account locally.
    }

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
    this.backendAccount = false;
  }
}
