import { Injectable } from '@angular/core';
import { NewSavedFarm, SavedFarm } from '../map/models/map.models';

/**
 * `LandsApiService` backed by a plain in-memory array — no HTTP. Seed it
 * directly via the public array before a test runs. Like the backend,
 * `saveFarm` mints the numeric id.
 */
@Injectable()
export class FakeLandsApiService {
  farms: SavedFarm[] = [];

  private nextId = 1000;

  async getFarms(): Promise<SavedFarm[]> {
    return [...this.farms];
  }
  async saveFarm(_userId: number, farm: NewSavedFarm): Promise<SavedFarm> {
    const saved: SavedFarm = { ...farm, id: this.nextId++, createdAt: Date.now() };
    this.farms.push(saved);
    return saved;
  }
  async updateFarm(_userId: number, id: number, updates: Partial<SavedFarm>): Promise<void> {
    this.farms = this.farms.map((f) => (f.id === id ? { ...f, ...updates } : f));
  }
  async deleteFarm(_userId: number, id: number): Promise<void> {
    this.farms = this.farms.filter((f) => f.id !== id);
  }
}
