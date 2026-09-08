import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { WorkflowStateService } from '../workflow/workflow-state.service';
import { IStorageService } from '../storage/storage.interface';

const ACTIVE_USER_ID_KEY = 'my_farm_active_user_id';
const SESSION_EXPIRY_KEY = 'my_farm_session_expiry';
const FIREBASE_TOKEN_KEY = 'my_farm_firebase_token';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly registrationService = inject(FarmerRegistrationService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly storageService = inject(IStorageService);

  private readonly currentUserSignal = signal<FarmerRegistrationData | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /** False until the persisted session has been checked (guards wait on `whenReady`). */
  readonly initialized = signal(false);
  private readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.loadSession().then(() => this.initialized.set(true));

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

  /**
   * Log in a farmer and optionally set their Firebase ID token for API requests.
   * @param farmer The farmer profile
   * @param firebaseToken Optional Firebase ID token for authenticated API calls (Stage 4)
   */
  login(farmer: FarmerRegistrationData, firebaseToken?: string): void {
    this.currentUserSignal.set(farmer);
    localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));

    // Stage 4: always rebind the API credential to *this* login. The storage
    // service is a root singleton, so without the else-branch a tokenless
    // login (PIN, demo) would keep the previous farmer's bearer token and
    // read their data.
    if (firebaseToken) {
      localStorage.setItem(FIREBASE_TOKEN_KEY, firebaseToken);
    } else {
      localStorage.removeItem(FIREBASE_TOKEN_KEY);
    }
    if (this.isApiStorageService(this.storageService)) {
      this.storageService.setAuthToken(firebaseToken ?? null);
    }

    this.workflowService.markPhaseComplete('registration');
  }

  /**
   * Drop the Firebase token from both localStorage and the storage
   * singleton. Called on logout, on session expiry, and on a failed
   * session restore — anywhere the current identity stops being valid.
   */
  private clearFirebaseToken(): void {
    localStorage.removeItem(FIREBASE_TOKEN_KEY);
    if (this.isApiStorageService(this.storageService)) {
      this.storageService.setAuthToken(null);
    }
  }

  /**
   * Restore Firebase token from session storage after app reload.
   * Called during session initialization.
   */
  private restoreFirebaseToken(): void {
    const token = localStorage.getItem(FIREBASE_TOKEN_KEY);
    if (token && this.isApiStorageService(this.storageService)) {
      this.storageService.setAuthToken(token);
    }
  }

  /** Type guard to check if storage service has a setAuthToken method (ApiStorageService,
   * or anything else layered on top of it, e.g. the offline outbox). */
  private isApiStorageService(
    service: IStorageService,
  ): service is IStorageService & { setAuthToken(token: string | null): void } {
    return typeof (service as { setAuthToken?: unknown }).setAuthToken === 'function';
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
    this.clearFirebaseToken();
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
      this.clearFirebaseToken();
      return false;
    }
    return true;
  }

  private async loadSession(): Promise<void> {
    try {
      const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
      const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);

      if (activeId && expiry && Date.now() <= Number(expiry)) {
        const found = await this.registrationService.findById(activeId);
        if (found) {
          this.currentUserSignal.set(found);
          // Restore Firebase token for API requests (Stage 4)
          this.restoreFirebaseToken();
          return;
        }
      }

      if (activeId || expiry) {
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
        this.clearFirebaseToken();
      }
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
  }
}
