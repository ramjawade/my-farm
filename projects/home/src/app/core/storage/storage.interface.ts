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
 *
 * Every mutation is per-entity (save/update/delete one record) — nothing
 * here reads or writes a whole collection at once. A whole-collection
 * replace over a network causes lost-update races between devices editing
 * different records at the same time, and (for farmers specifically) a
 * whole-table read/write is something no authenticated API should expose.
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
  abstract saveCrop(userId: string, crop: CropEntity): Promise<CropEntity>;
  abstract updateCrop(userId: string, id: string, updates: Partial<CropEntity>): Promise<void>;
  abstract deleteCrop(userId: string, id: string): Promise<void>;

  // --- Lands (drawn farm plots) ---
  abstract getFarms(userId: string): Promise<SavedFarm[]>;
  abstract saveFarm(userId: string, farm: SavedFarm): Promise<SavedFarm>;
  abstract updateFarm(userId: string, id: string, updates: Partial<SavedFarm>): Promise<void>;
  abstract deleteFarm(userId: string, id: string): Promise<void>;

  // --- Farmer profiles (accounts) ---
  // Lookup only — never a whole-table read or write. A backend can serve
  // these from an authenticated identity lookup; nothing here can be asked
  // to dump every farmer on the device (or, later, the tenant).
  abstract getFarmerById(id: string): Promise<FarmerRegistrationData | undefined>;
  abstract getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined>;
  abstract saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData>;

  // --- Weather ---
  abstract getWeatherHistory(userId: string): Promise<WeatherData[]>;
  abstract saveWeatherSnapshot(userId: string, snapshot: WeatherData): Promise<WeatherData>;
}
