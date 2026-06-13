import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';

const ACTIVE_USER_ID_KEY = 'my_farm_active_user_id';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly registrationService = inject(FarmerRegistrationService);

  private readonly currentUserSignal = signal<FarmerRegistrationData | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  constructor() {
    this.loadSession();

    // Auto-save user ID to storage when it changes
    effect(() => {
      const user = this.currentUserSignal();
      if (user) {
        localStorage.setItem(ACTIVE_USER_ID_KEY, user.id);
      } else {
        localStorage.removeItem(ACTIVE_USER_ID_KEY);
      }
    });
  }

  login(farmer: FarmerRegistrationData): void {
    this.currentUserSignal.set(farmer);
  }

  updateProfile(updates: Partial<FarmerRegistrationData>): void {
    const user = this.currentUserSignal();
    if (user) {
      const updated = this.registrationService.updateFarmer(user.id, updates);
      if (updated) {
        this.currentUserSignal.set(updated);
      }
    }
  }

  logout(): void {
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  private loadSession(): void {
    try {
      const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
      if (activeId) {
        // Wait, registrationService has a registeredFarmers signal. Let's look up the user.
        const farmers = this.registrationService.registeredFarmers();
        const found = farmers.find(f => f.id === activeId);
        if (found) {
          this.currentUserSignal.set(found);
          return;
        }
      }
      // If there's only one registered farmer (the default seeded one), auto-login for convenience?
      // No, let them explicitly see the login page if they cleared storage, but if default is seeded,
      // let's auto-login if no active ID is set and there's a default.
      // Wait, let's check: if activeId is not set, we can leave it null to show the login screen.
      // This is better so they can see the login screen first!
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
  }
}
