import { Injectable, inject, signal } from '@angular/core';
import { FarmerRegistrationData } from './farmer-registration.models';
import { IStorageService } from '../../core/storage/storage.interface';

@Injectable({
  providedIn: 'root',
})
export class FarmerRegistrationService {
  private readonly storage = inject(IStorageService);
  private readonly farmersSignal = signal<FarmerRegistrationData[]>([]);
  readonly registeredFarmers = this.farmersSignal.asReadonly();

  /** Resolves once the farmer list has been loaded from storage. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.loadFromStorage();
  }

  registerFarmer(data: Omit<FarmerRegistrationData, 'id' | 'createdAt'>): FarmerRegistrationData {
    const newFarmer: FarmerRegistrationData = {
      ...data,
      id: this.generateUUID(),
      createdAt: Date.now(),
    };
    this.setFarmers([newFarmer, ...this.farmersSignal()]);
    return newFarmer;
  }

  /** Insert or replace a farmer record by id (used for demo / restore). */
  upsertFarmer(farmer: FarmerRegistrationData): void {
    const current = this.farmersSignal();
    const exists = current.some((f) => f.id === farmer.id);
    this.setFarmers(
      exists ? current.map((f) => (f.id === farmer.id ? farmer : f)) : [farmer, ...current],
    );
  }

  clearAll(): void {
    this.setFarmers([]);
  }

  updateFarmer(
    id: string,
    updates: Partial<FarmerRegistrationData>,
  ): FarmerRegistrationData | null {
    let updatedFarmer: FarmerRegistrationData | null = null;
    const updated = this.farmersSignal().map((f) => {
      if (f.id === id) {
        updatedFarmer = { ...f, ...updates };
        return updatedFarmer;
      }
      return f;
    });

    if (updatedFarmer) {
      this.setFarmers(updated);
    }
    return updatedFarmer;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      this.farmersSignal.set(await this.storage.getFarmers());
    } catch (e) {
      console.error('Failed to load registered farmers', e);
      this.farmersSignal.set([]);
    }
  }

  private setFarmers(farmers: FarmerRegistrationData[]): void {
    this.farmersSignal.set(farmers);
    this.storage.saveFarmers(farmers).catch((e) => console.error('Failed to save farmers', e));
  }

  private generateUUID(): string {
    // Basic but unique enough for local storage ID generation
    return 'f-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }
}
