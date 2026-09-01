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

  updateFarmer(id: string, updates: Partial<FarmerRegistrationData>): FarmerRegistrationData | null {
    let updatedFarmer: FarmerRegistrationData | null = null;
    const current = this.farmersSignal();
    const updated = current.map(f => {
      if (f.id === id) {
        updatedFarmer = { ...f, ...updates };
        return updatedFarmer;
      }
      return f;
    });

    if (updatedFarmer) {
      this.farmersSignal.set(updated);
      this.saveToStorage(updated);
    }
    return updatedFarmer;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FarmerRegistrationData[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.farmersSignal.set(parsed);
          return;
        }
      }
      this.seedDefaultFarmer();
    } catch (e) {
      console.error('Failed to load registered farmers from localStorage', e);
      this.seedDefaultFarmer();
    }
  }

  private seedDefaultFarmer(): void {
    const defaultFarmer: FarmerRegistrationData = {
      id: 'f-default',
      fullName: 'Ram Jawade',
      phone: '9876543210',
      email: 'ram.jawade@myfarm.com',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Green Valley Farm',
      farmArea: 6.5,
      farmAreaUnit: 'hectares',
      primaryCrops: ['Soybeans', 'Wheat'],
      waterSource: 'Borewell',
      irrigationType: 'Drip',
      farmingMethod: 'Organic',
      locationType: 'map',
      location: { lat: 20.5937, lng: 78.9629 },
      createdAt: Date.now()
    };
    this.farmersSignal.set([defaultFarmer]);
    this.saveToStorage([defaultFarmer]);
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
