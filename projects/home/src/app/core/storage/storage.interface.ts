import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { CropEntity } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';
import { BackupFile } from './backup.models';

/**
 * Single persistence boundary for the app. Feature services talk to this and
 * never to `localStorage` directly, so swapping in a backend is a DI change.
 * Every method is async so a remote implementation fits the same contract.
 */
export abstract class IStorageService {
  // --- Activities & expenses ---
  abstract getActivities(userId: string): Promise<Activity[]>;
  abstract getExpenses(userId: string): Promise<ActivityExpense[]>;
  abstract saveActivity(userId: string, activity: Activity): Promise<Activity>;
  abstract saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense>;
  abstract updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void>;
  abstract updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void>;
  abstract deleteActivity(userId: string, id: string): Promise<void>;
  abstract deleteExpense(userId: string, id: string): Promise<void>;
  abstract syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]>;
  abstract syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]>;

  // --- Crops ---
  abstract getCrops(userId: string): Promise<CropEntity[]>;
  abstract saveCrops(userId: string, crops: CropEntity[]): Promise<void>;

  // --- Lands (drawn farm plots) ---
  abstract getFarms(userId: string): Promise<SavedFarm[]>;
  abstract saveFarms(userId: string, farms: SavedFarm[]): Promise<void>;

  // --- Farmer profiles (accounts) ---
  abstract getFarmers(): Promise<FarmerRegistrationData[]>;
  abstract saveFarmers(farmers: FarmerRegistrationData[]): Promise<void>;

  // --- Weather ---
  abstract getWeatherHistory(userId: string): Promise<WeatherData[]>;
  abstract saveWeatherHistory(userId: string, history: WeatherData[]): Promise<void>;

  // --- Whole-account operations (backup / restore / reset) ---
  abstract exportUserData(userId: string): Promise<BackupFile>;
  abstract importUserData(userId: string, backup: BackupFile): Promise<void>;
  abstract clearUserData(userId: string): Promise<void>;
}
