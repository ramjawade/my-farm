import { Injectable, signal } from '@angular/core';
import { FarmerRegistrationData } from './farmer-registration.models';

const STORAGE_KEY = 'my_farm_registered_farmers';

@Injectable({
  providedIn: 'root'
})
export class FarmerRegistrationService {
  private readonly farmersSignal = signal<FarmerRegistrationData[]>([]);
  readonly registeredFarmers = this.farmersSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  registerFarmer(data: Omit<FarmerRegistrationData, 'id' | 'createdAt'>): FarmerRegistrationData {
    const newFarmer: FarmerRegistrationData = {
      ...data,
      id: this.generateUUID(),
      createdAt: Date.now()
    };

    const currentFarmers = this.farmersSignal();
    const updatedFarmers = [newFarmer, ...currentFarmers];
    
    this.farmersSignal.set(updatedFarmers);
    this.saveToStorage(updatedFarmers);

    return newFarmer;
  }

  clearAll(): void {
    this.farmersSignal.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FarmerRegistrationData[];
        if (Array.isArray(parsed)) {
          this.farmersSignal.set(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load registered farmers from localStorage', e);
      this.farmersSignal.set([]);
    }
  }

  private saveToStorage(farmers: FarmerRegistrationData[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(farmers));
    } catch (e) {
      console.error('Failed to save registered farmers to localStorage', e);
    }
  }

  private generateUUID(): string {
    // Basic but unique enough for local storage ID generation
    return 'f-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }
}
