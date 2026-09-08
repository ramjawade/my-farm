import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SessionAuthService, SessionResult } from '../../core/auth/session-auth.service';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';

type LoginStep = 'phone' | 'pin' | 'register';

const PIN_RE = /^[0-9]{4,6}$/;
const UNREACHABLE = 'Cannot reach the server. Check your connection and try again.';

/**
 * PIN sign-in (issues #45, #50). **Online-only**: every step needs the
 * backend. A network failure shows a retry message and never creates a
 * local account — an identity can't be minted offline and reconciled later.
 */
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
  readonly busy = signal(false);

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/map']);
    }
  }

  onSubmitPhone(): void {
    const digitsOnly = this.phone().trim().replace(/\D/g, '');
    const phoneVal = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

    if (phoneVal.length !== 10) {
      this.errorMessage.set('Please enter a valid 10-digit mobile number.');
      return;
    }

    this.phone.set(phoneVal);
    this.errorMessage.set('');
    this.step.set('pin');
  }

  async onSubmitPin(): Promise<void> {
    const pinVal = this.pin().trim();
    if (!PIN_RE.test(pinVal)) {
      this.errorMessage.set('Please enter a valid 4-6 digit PIN.');
      return;
    }

    this.errorMessage.set('');
    this.busy.set(true);
    try {
      const outcome = await this.sessionAuth.createSession(this.phone(), pinVal);
      switch (outcome.status) {
        case 'ok':
          this.enter(outcome.result);
          return;
        case 'no-account':
          // First time on this number — collect a name and register.
          this.name.set('');
          this.confirmPin.set('');
          this.step.set('register');
          return;
        case 'wrong-pin':
          this.errorMessage.set('Incorrect PIN. Please try again.');
          return;
        case 'unreachable':
          this.errorMessage.set(UNREACHABLE);
          return;
      }
    } finally {
      this.busy.set(false);
    }
  }

  async onSubmitRegister(): Promise<void> {
    const nameVal = this.name().trim();
    const pinVal = this.pin().trim();
    const confirmVal = this.confirmPin().trim();

    if (nameVal.length < 3) {
      this.errorMessage.set('Please enter your full name (minimum 3 characters).');
      return;
    }
    if (!PIN_RE.test(pinVal)) {
      this.errorMessage.set('Please enter a valid 4-6 digit PIN.');
      return;
    }
    if (pinVal !== confirmVal) {
      this.errorMessage.set('PINs do not match.');
      return;
    }

    this.errorMessage.set('');
    this.busy.set(true);
    try {
      const outcome = await this.sessionAuth.register({
        phone: this.phone(),
        fullName: nameVal,
        pin: pinVal,
      });
      switch (outcome.status) {
        case 'ok':
          this.enter(outcome.result);
          return;
        case 'phone-taken':
          this.pin.set('');
          this.confirmPin.set('');
          this.step.set('pin');
          this.errorMessage.set('That number is already registered. Enter your PIN to sign in.');
          return;
        case 'unreachable':
          this.errorMessage.set(UNREACHABLE);
          return;
      }
    } finally {
      this.busy.set(false);
    }
  }

  resetToPhoneStep(): void {
    this.step.set('phone');
    this.pin.set('');
    this.confirmPin.set('');
    this.name.set('');
    this.errorMessage.set('');
  }

  /** login() first so the API session token is bound before upsertFarmer()
   * triggers a PATCH /me through the storage layer. */
  private enter(session: SessionResult): void {
    this.errorMessage.set('');
    this.authService.login(session.farmer, session.token);
    this.farmerService.upsertFarmer(session.farmer);
    this.router.navigate(['/map']);
  }
}
