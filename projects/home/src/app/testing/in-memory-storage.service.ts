import { Injectable } from '@angular/core';
import { IStorageService } from '../core/storage/storage.interface';
import { Activity, ActivityExpense } from '../features/activity/activity.models';
import { CropEntity } from '../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../map/models/map.models';
import { WeatherData } from '../core/weather/weather.models';

/**
 * `IStorageService` backed by plain in-memory arrays — no `localStorage`,
 * no HTTP. The real implementations are `ApiStorageService` (production,
 * online-only) and this one for specs that only need the persistence seam
 * satisfied. Seed it directly via the public arrays before a test runs.
 */
@Injectable()
export class InMemoryStorageService extends IStorageService {
  activities: Activity[] = [];
  expenses: ActivityExpense[] = [];
  crops: CropEntity[] = [];
  farms: SavedFarm[] = [];
  farmers: FarmerRegistrationData[] = [];
  weather: WeatherData[] = [];

  async getActivities(): Promise<Activity[]> {
    return [...this.activities];
  }
  async getExpenses(): Promise<ActivityExpense[]> {
    return [...this.expenses];
  }
  async saveActivity(_userId: string, activity: Activity): Promise<Activity> {
    this.activities.push(activity);
    return activity;
  }
  async saveExpense(_userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    this.expenses.push(expense);
    return expense;
  }
  async updateActivity(_userId: string, id: string, updates: Partial<Activity>): Promise<void> {
    this.activities = this.activities.map((a) => (a.id === id ? { ...a, ...updates } : a));
  }
  async updateExpense(
    _userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e));
  }
  async deleteActivity(_userId: string, id: string): Promise<void> {
    this.activities = this.activities.filter((a) => a.id !== id);
  }
  async deleteExpense(_userId: string, id: string): Promise<void> {
    this.expenses = this.expenses.filter((e) => e.id !== id);
  }
  async syncActivitiesForField(_userId: string, fieldId: string): Promise<Activity[]> {
    return this.activities.filter((a) => a.fieldId === fieldId);
  }
  async syncExpensesForActivity(_userId: string, activityId: string): Promise<ActivityExpense[]> {
    return this.expenses.filter((e) => e.activityId === activityId);
  }

  async getCrops(): Promise<CropEntity[]> {
    return [...this.crops];
  }
  async saveCrop(_userId: string, crop: CropEntity): Promise<CropEntity> {
    this.crops.push(crop);
    return crop;
  }
  async updateCrop(_userId: string, id: string, updates: Partial<CropEntity>): Promise<void> {
    this.crops = this.crops.map((c) => (c.id === id ? { ...c, ...updates } : c));
  }
  async deleteCrop(_userId: string, id: string): Promise<void> {
    this.crops = this.crops.filter((c) => c.id !== id);
  }

  async getFarms(): Promise<SavedFarm[]> {
    return [...this.farms];
  }
  async saveFarm(_userId: string, farm: SavedFarm): Promise<SavedFarm> {
    this.farms.push(farm);
    return farm;
  }
  async updateFarm(_userId: string, id: string, updates: Partial<SavedFarm>): Promise<void> {
    this.farms = this.farms.map((f) => (f.id === id ? { ...f, ...updates } : f));
  }
  async deleteFarm(_userId: string, id: string): Promise<void> {
    this.farms = this.farms.filter((f) => f.id !== id);
  }

  async getFarmerById(id: string): Promise<FarmerRegistrationData | undefined> {
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
  async saveWeatherSnapshot(_userId: string, snapshot: WeatherData): Promise<WeatherData> {
    this.weather.push(snapshot);
    return snapshot;
  }
}
