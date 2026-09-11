import { Injectable } from '@angular/core';
import { IStorageService } from '../core/storage/storage.interface';
import {
  Activity,
  ActivityExpense,
  NewActivity,
  NewActivityExpense,
} from '../features/activity/activity.models';
import { CropEntity, NewCrop } from '../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../features/farmer-registration/farmer-registration.models';
import { NewSavedFarm, SavedFarm } from '../map/models/map.models';
import { WeatherData } from '../core/weather/weather.models';

/**
 * `IStorageService` backed by plain in-memory arrays — no `localStorage`,
 * no HTTP. The real implementations are `ApiStorageService` (production,
 * online-only) and this one for specs that only need the persistence seam
 * satisfied. Seed it directly via the public arrays before a test runs.
 * Like the backend, `save*` mints the numeric id.
 */
@Injectable()
export class InMemoryStorageService extends IStorageService {
  activities: Activity[] = [];
  expenses: ActivityExpense[] = [];
  crops: CropEntity[] = [];
  farms: SavedFarm[] = [];
  farmers: FarmerRegistrationData[] = [];
  weather: WeatherData[] = [];

  private nextId = 1000;

  async getActivities(): Promise<Activity[]> {
    return [...this.activities];
  }
  async getExpenses(): Promise<ActivityExpense[]> {
    return [...this.expenses];
  }
  async saveActivity(_userId: number, activity: NewActivity): Promise<Activity> {
    const now = Date.now();
    const saved: Activity = { ...activity, id: this.nextId++, createdAt: now, updatedAt: now };
    this.activities.push(saved);
    return saved;
  }
  async saveExpense(_userId: number, expense: NewActivityExpense): Promise<ActivityExpense> {
    const saved: ActivityExpense = { ...expense, id: this.nextId++, createdAt: Date.now() };
    this.expenses.push(saved);
    return saved;
  }
  async updateActivity(_userId: number, id: number, updates: Partial<Activity>): Promise<void> {
    this.activities = this.activities.map((a) => (a.id === id ? { ...a, ...updates } : a));
  }
  async updateExpense(
    _userId: number,
    id: number,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e));
  }
  async deleteActivity(_userId: number, id: number): Promise<void> {
    this.activities = this.activities.filter((a) => a.id !== id);
  }
  async deleteExpense(_userId: number, id: number): Promise<void> {
    this.expenses = this.expenses.filter((e) => e.id !== id);
  }
  async syncActivitiesForField(_userId: number, fieldId: number): Promise<Activity[]> {
    return this.activities.filter((a) => a.fieldId === fieldId);
  }
  async syncExpensesForActivity(_userId: number, activityId: number): Promise<ActivityExpense[]> {
    return this.expenses.filter((e) => e.activityId === activityId);
  }

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

  async getWeatherHistory(): Promise<WeatherData[]> {
    return [...this.weather];
  }
  async saveWeatherSnapshot(_userId: number, snapshot: WeatherData): Promise<WeatherData> {
    this.weather.push(snapshot);
    return snapshot;
  }
}
