import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { WorkflowStateService } from '../workflow/workflow-state.service';
import { HttpService } from '../http/http.service';

const ACTIVE_USER_ID_KEY = 'my_farm_active_user_id';
const SESSION_EXPIRY_KEY = 'my_farm_session_expiry';
const SESSION_TOKEN_KEY = 'my_farm_session_token';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly registrationService = inject(FarmerRegistrationService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly httpService = inject(HttpService);

  private readonly currentUserSignal = signal<FarmerRegistrationData | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /** False until the persisted session has been checked (guards wait on `whenReady`). */
  readonly initialized = signal(false);
  private readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.loadSession().then(() => this.initialized.set(true));

    // Persist `currentUserSignal` changes to storage. Session restore
    // (`loadSession`) hasn't resolved on the very first run of this effect —
    // `currentUserSignal` is still its initial `null` — so that first run
    // must not be read as "the user logged out": doing so wiped the
    // just-restored session's keys before `loadSession` finished reading
    // them, logging every user out on their very next reload.
    effect(() => {
      const user = this.currentUserSignal();
      if (!this.initialized()) return;
      if (user) {
        localStorage.setItem(ACTIVE_USER_ID_KEY, String(user.id));
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
   * Log in a farmer and optionally set their API session token.
   *
   * The token is either a Firebase ID token or a backend-issued PIN session
   * JWT (issue #45) — `ApiStorageService` sends whichever it's given as the
   * bearer credential, and the backend auth dependency accepts both.
   *
   * @param farmer The farmer profile
   * @param sessionToken Optional bearer token for authenticated API calls
   */
  login(farmer: FarmerRegistrationData, sessionToken?: string): void {
    this.currentUserSignal.set(farmer);
    localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));

    // Always rebind the API credential to *this* login. The storage service
    // is a root singleton, so without the else-branch a tokenless login
    // would keep the previous farmer's bearer token and read their data.
    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
    this.httpService.setAuthToken(sessionToken ?? null);

    this.workflowService.markPhaseComplete('registration');
  }

  /**
   * Drop the session token from both localStorage and the storage
   * singleton. Called on logout, on session expiry, and on a failed
   * session restore — anywhere the current identity stops being valid.
   * On expiry the auth guard then sends the farmer back to /login to
   * re-enter their PIN.
   */
  private clearSessionToken(): void {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    this.httpService.setAuthToken(null);
  }

  /**
   * Restore the session token from storage after an app reload.
   * Called during session initialization.
   */
  private restoreSessionToken(): void {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (token) {
      this.httpService.setAuthToken(token);
    }
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
    this.clearSessionToken();
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
      this.clearSessionToken();
      return false;
    }
    return true;
  }

  private async loadSession(): Promise<void> {
    try {
      const storedId = localStorage.getItem(ACTIVE_USER_ID_KEY);
      const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
      // A session saved before ids went numeric holds a UUID -> NaN -> treated as no session.
      const activeId = Number(storedId);

      if (Number.isInteger(activeId) && activeId > 0 && expiry && Date.now() <= Number(expiry)) {
        const found = await this.registrationService.findById(activeId);
        if (found) {
          this.currentUserSignal.set(found);
          // Restore the API session token so authenticated requests work
          // across a page reload.
          this.restoreSessionToken();
          return;
        }
      }

      if (storedId || expiry) {
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
        this.clearSessionToken();
      }
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
  }
}
