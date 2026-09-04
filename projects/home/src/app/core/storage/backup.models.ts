import { Activity, ActivityExpense } from '../../features/activity/activity.models';
import { CropEntity } from '../../features/crop-timeline/crop-timeline.models';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { SavedFarm } from '../../map/models/map.models';
import { WeatherData } from '../weather/weather.models';

export const BACKUP_SCHEMA_VERSION = 2;

/** Everything one farmer owns, in a single portable JSON document. */
export interface BackupFile {
  app: 'my-farm';
  schemaVersion: number;
  exportedAt: number;
  userId: string;
  farmer?: FarmerRegistrationData;
  farms: SavedFarm[];
  crops: CropEntity[];
  activities: Activity[];
  expenses: ActivityExpense[];
  weatherHistory: WeatherData[];
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['app'] === 'my-farm' &&
    typeof v['schemaVersion'] === 'number' &&
    Array.isArray(v['farms']) &&
    Array.isArray(v['crops']) &&
    Array.isArray(v['activities']) &&
    Array.isArray(v['expenses'])
  );
}
