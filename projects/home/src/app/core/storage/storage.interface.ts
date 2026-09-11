import {
  Activity,
  ActivityExpense,
  NewActivity,
  NewActivityExpense,
} from '../../features/activity/activity.models';
import { CropEntity, NewCrop } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { NewSavedFarm, SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';

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
 *
 * Ids are numeric and minted by the backend: `save*` takes a record without
 * one and resolves with the stored record, id included.
 */
export abstract class IStorageService {
  // --- Activities & expenses ---
  abstract getActivities(userId: number): Promise<Activity[]>;
  abstract getExpenses(userId: number): Promise<ActivityExpense[]>;
  abstract saveActivity(userId: number, activity: NewActivity): Promise<Activity>;
  abstract saveExpense(userId: number, expense: NewActivityExpense): Promise<ActivityExpense>;
  abstract updateActivity(userId: number, id: number, updates: Partial<Activity>): Promise<void>;
  abstract updateExpense(
    userId: number,
    id: number,
    updates: Partial<ActivityExpense>,
  ): Promise<void>;
  abstract deleteActivity(userId: number, id: number): Promise<void>;
  abstract deleteExpense(userId: number, id: number): Promise<void>;
  abstract syncActivitiesForField(userId: number, fieldId: number): Promise<Activity[]>;
  abstract syncExpensesForActivity(userId: number, activityId: number): Promise<ActivityExpense[]>;

  // --- Crops ---
  abstract getCrops(userId: number): Promise<CropEntity[]>;
  abstract saveCrop(userId: number, crop: NewCrop): Promise<CropEntity>;
  abstract updateCrop(userId: number, id: number, updates: Partial<CropEntity>): Promise<void>;
  abstract deleteCrop(userId: number, id: number): Promise<void>;

  // --- Lands (drawn farm plots) ---
  abstract getFarms(userId: number): Promise<SavedFarm[]>;
  abstract saveFarm(userId: number, farm: NewSavedFarm): Promise<SavedFarm>;
  abstract updateFarm(userId: number, id: number, updates: Partial<SavedFarm>): Promise<void>;
  abstract deleteFarm(userId: number, id: number): Promise<void>;

  // --- Farmer profiles (accounts) ---
  // Lookup only — never a whole-table read or write. A backend can serve
  // these from an authenticated identity lookup; nothing here can be asked
  // to dump every farmer on the device (or, later, the tenant).
  abstract getFarmerById(id: number): Promise<FarmerRegistrationData | undefined>;
  abstract getFarmerByPhone(phone: string): Promise<FarmerRegistrationData | undefined>;
  abstract saveFarmer(farmer: FarmerRegistrationData): Promise<FarmerRegistrationData>;

  // --- Weather ---
  abstract getWeatherHistory(userId: number): Promise<WeatherData[]>;
  abstract saveWeatherSnapshot(userId: number, snapshot: WeatherData): Promise<WeatherData>;
}
