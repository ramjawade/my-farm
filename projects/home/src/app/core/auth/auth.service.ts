import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';

const ACTIVE_USER_ID_KEY = 'my_farm_active_user_id';
const SESSION_EXPIRY_KEY = 'my_farm_session_expiry';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly registrationService = inject(FarmerRegistrationService);

  private readonly currentUserSignal = signal<FarmerRegistrationData | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /** False until the persisted session has been checked (guards wait on `whenReady`). */
  readonly initialized = signal(false);
  private readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.registrationService.ready
      .then(() => this.loadSession())
      .catch((e) => console.error('Failed to restore session', e))
      .then(() => this.initialized.set(true));

    effect(() => {
      const user = this.currentUserSignal();
      if (user) {
        localStorage.setItem(ACTIVE_USER_ID_KEY, user.id);
      } else {
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
      }
    });
  }

  /** Resolves once session restore has finished. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  login(farmer: FarmerRegistrationData): void {
    this.currentUserSignal.set(farmer);
    localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
  }

  updateProfile(updates: Partial<FarmerRegistrationData>): void {
    const user = this.currentUserSignal();
    if (user) {
      // Upsert: the farmer list may still be loading (or the user came from a
      // demo login), so never drop a profile edit on the floor.
      const updated = { ...user, ...updates };
      this.registrationService.upsertFarmer(updated);
      this.currentUserSignal.set(updated);
    }
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    this.router.navigate(['/login']);
  }

  /** Returns true if there's a valid, non-expired session. Logs out and clears state if expired. */
  isSessionValid(): boolean {
    if (!this.currentUserSignal()) {
      return false;
    }
    const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!expiry || Date.now() > Number(expiry)) {
      this.currentUserSignal.set(null);
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      return false;
    }
    return true;
  }

  private loadSession(): void {
    try {
      const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
      const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);

      if (activeId && expiry && Date.now() <= Number(expiry)) {
        const farmers = this.registrationService.registeredFarmers();
        const found = farmers.find((f) => f.id === activeId);
        if (found) {
          this.currentUserSignal.set(found);
          return;
        }
      }

      if (activeId || expiry) {
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
      }
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
  }
}
