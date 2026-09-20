import { Injectable } from '@angular/core';
import { FarmerRegistrationData } from '../features/farmer-registration/farmer-registration.models';

/**
 * `FarmerProfileApiService` backed by a plain in-memory array — no HTTP.
 * Seed it directly via the public array before a test runs.
 */
@Injectable()
export class FakeFarmerProfileApiService {
  farmers: FarmerRegistrationData[] = [];

  async getFarmerById(id: number): Promise<FarmerRegistrationData | undefined> {
    return this.farmers.find((f) => f.id === id);
  }
  async getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined> {
    return this.farmers.find((f) => f.phone === phone);
  }
  async saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData> {
    const idx = this.farmers.findIndex((f) => f.id === farmer.id);
    if (idx >= 0) this.farmers[idx] = farmer;
    else this.farmers.push(farmer);
    return farmer;
  }
}
