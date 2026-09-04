import { Injectable } from '@angular/core';
import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { CropEntity } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { IStorageService } from './storage.interface';
import { BACKUP_SCHEMA_VERSION, BackupFile } from './backup.models';

const FARMERS_KEY = 'my_farm_registered_farmers';

/** Browser `localStorage` implementation. One key per user per collection. */
@Injectable({ providedIn: 'root' })
export class LocalStorageService extends IStorageService {
  private userKey(userId: string, collection: string): string {
    return `my_farm_${userId}_${collection}`;
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : fallback;
    } catch (e) {
      console.error(`Failed to read ${key} from localStorage`, e);
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to write ${key} to localStorage`, e);
    }
  }

  private getActivitiesKey(userId: string): string {
    return this.userKey(userId, 'activities');
  }

  private getExpensesKey(userId: string): string {
    return this.userKey(userId, 'activity_expenses');
  }

  // --- Activities & expenses ---
  async getActivities(userId: string): Promise<Activity[]> {
    return this.read<Activity[]>(this.getActivitiesKey(userId), []);
  }

  async getExpenses(userId: string): Promise<ActivityExpense[]> {
    return this.read<ActivityExpense[]>(this.getExpensesKey(userId), []);
  }

  async saveActivity(userId: string, activity: Activity): Promise<Activity> {
    const activities = await this.getActivities(userId);
    activities.push(activity);
    this.write(this.getActivitiesKey(userId), activities);
    return activity;
  }

  async saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense> {
    const expenses = await this.getExpenses(userId);
    expenses.push(expense);
    this.write(this.getExpensesKey(userId), expenses);
    return expense;
  }

  async updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void> {
    const activities = await this.getActivities(userId);
    const index = activities.findIndex((a) => a.id === id);
    if (index !== -1) {
      activities[index] = { ...activities[index], ...updates };
      this.write(this.getActivitiesKey(userId), activities);
    }
  }

  async updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    const expenses = await this.getExpenses(userId);
    const index = expenses.findIndex((e) => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      this.write(this.getExpensesKey(userId), expenses);
    }
  }

  async deleteActivity(userId: string, id: string): Promise<void> {
    const activities = await this.getActivities(userId);
    this.write(
      this.getActivitiesKey(userId),
      activities.filter((a) => a.id !== id),
    );
  }

  async deleteExpense(userId: string, id: string): Promise<void> {
    const expenses = await this.getExpenses(userId);
    this.write(
      this.getExpensesKey(userId),
      expenses.filter((e) => e.id !== id),
    );
  }

  async syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]> {
    const activities = await this.getActivities(userId);
    return activities.filter((a) => a.fieldId === fieldId);
  }

  async syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]> {
    const expenses = await this.getExpenses(userId);
    return expenses.filter((e) => e.activityId === activityId);
  }

  // --- Crops ---
  async getCrops(userId: string): Promise<CropEntity[]> {
    return this.read<CropEntity[]>(this.userKey(userId, 'crops'), []);
  }

  async saveCrops(userId: string, crops: CropEntity[]): Promise<void> {
    this.write(this.userKey(userId, 'crops'), crops);
  }

  // --- Lands ---
  async getFarms(userId: string): Promise<SavedFarm[]> {
    return this.read<SavedFarm[]>(this.userKey(userId, 'saved_farms'), []);
  }

  async saveFarms(userId: string, farms: SavedFarm[]): Promise<void> {
    this.write(this.userKey(userId, 'saved_farms'), farms);
  }

  // --- Farmers ---
  async getFarmers(): Promise<FarmerRegistrationData[]> {
    const list = this.read<FarmerRegistrationData[]>(FARMERS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  async saveFarmers(farmers: FarmerRegistrationData[]): Promise<void> {
    this.write(FARMERS_KEY, farmers);
  }

  // --- Weather ---
  async getWeatherHistory(userId: string): Promise<WeatherData[]> {
    return this.read<WeatherData[]>(this.userKey(userId, 'weather_history'), []);
  }

  async saveWeatherHistory(userId: string, history: WeatherData[]): Promise<void> {
    this.write(this.userKey(userId, 'weather_history'), history);
  }

  // --- Whole-account operations ---
  async exportUserData(userId: string): Promise<BackupFile> {
    const farmers = await this.getFarmers();
    return {
      app: 'my-farm',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: Date.now(),
      userId,
      farmer: farmers.find((f) => f.id === userId),
      farms: await this.getFarms(userId),
      crops: await this.getCrops(userId),
      activities: await this.getActivities(userId),
      expenses: await this.getExpenses(userId),
      weatherHistory: await this.getWeatherHistory(userId),
    };
  }

  async importUserData(userId: string, backup: BackupFile): Promise<void> {
    await this.clearUserData(userId);
    await this.saveFarms(userId, backup.farms);
    await this.saveCrops(userId, backup.crops);
    this.write(this.getActivitiesKey(userId), backup.activities);
    this.write(this.getExpensesKey(userId), backup.expenses);
    await this.saveWeatherHistory(userId, backup.weatherHistory ?? []);
    if (backup.farmer) {
      const farmers = await this.getFarmers();
      const idx = farmers.findIndex((f) => f.id === userId);
      // Keep the current account identity/PIN; restore the farm profile fields.
      const merged = { ...backup.farmer, id: userId, pinHash: farmers[idx]?.pinHash };
      if (idx === -1) farmers.push(merged);
      else farmers[idx] = { ...farmers[idx], ...merged };
      await this.saveFarmers(farmers);
    }
  }

  async clearUserData(userId: string): Promise<void> {
    const prefix = `my_farm_${userId}_`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }
}
