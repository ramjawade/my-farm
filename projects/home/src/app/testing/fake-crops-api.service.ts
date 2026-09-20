import { Injectable } from '@angular/core';
import { CropEntity, NewCrop } from '../features/crop-timeline/crop-timeline.models';

/**
 * `CropsApiService` backed by a plain in-memory array — no HTTP. Seed it
 * directly via the public array before a test runs. Like the backend,
 * `saveCrop` mints the numeric id.
 */
@Injectable()
export class FakeCropsApiService {
  crops: CropEntity[] = [];

  private nextId = 1000;

  async getCrops(): Promise<CropEntity[]> {
    return [...this.crops];
  }
  async saveCrop(_userId: number, crop: NewCrop): Promise<CropEntity> {
    const saved: CropEntity = { ...crop, id: this.nextId++ };
    this.crops.push(saved);
    return saved;
  }
  async updateCrop(_userId: number, id: number, updates: Partial<CropEntity>): Promise<void> {
    this.crops = this.crops.map((c) => (c.id === id ? { ...c, ...updates } : c));
  }
  async deleteCrop(_userId: number, id: number): Promise<void> {
    this.crops = this.crops.filter((c) => c.id !== id);
  }
}
