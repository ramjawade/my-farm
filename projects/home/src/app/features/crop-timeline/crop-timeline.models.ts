import { Activity, ActivityType, ActivityStatus } from '../activity/activity.models';
import { Season } from '../../core/models/season';

// The crop timeline reads the unified activity model; these re-exports keep
// the crop feature's imports local without defining a second model.
export type { ActivityType, ActivityStatus };

export type CropStage =
  | 'Land Preparation'
  | 'Sowing'
  | 'Germination'
  | 'Vegetative Growth'
  | 'Flowering'
  | 'Fruiting / Pod Formation'
  | 'Maturity'
  | 'Harvest';

export const CROP_STAGES: readonly CropStage[] = [
  'Land Preparation',
  'Sowing',
  'Germination',
  'Vegetative Growth',
  'Flowering',
  'Fruiting / Pod Formation',
  'Maturity',
  'Harvest',
];

export type CropStatus = 'Active' | 'Completed' | 'Archived';

export interface CropEntity {
  id: string;
  fieldId: string; // SavedFarm.id of the land this crop grows on
  name: string; // User-friendly name
  cropType: string; // e.g. "Soybeans", "Wheat", "Rice"
  area: number; // size value as entered
  areaUnit: 'acres' | 'hectares';
  season?: Season; // derived from sowingDate when not given
  sowingDate?: number; // timestamp number
  currentStage: CropStage;
  status: CropStatus;
  expectedHarvestDate?: number; // timestamp number
  upcomingActivity?: string; // Quick dashboard note
}

/**
 * Read-only view of a unified `Activity` that is linked to a crop, with its
 * expense total folded in. Produced by `CropTimelineService.activities`.
 */
export interface CropActivity extends Activity {
  cropId: string;
  cost: number;
  notes: string;
  attachments: string[];
  metadata: NonNullable<Activity['metadata']>;
}

/** Input shape for logging an activity from the crop timeline. */
export interface CropActivityInput {
  id?: string;
  cropId: string;
  parentActivityId?: string;
  type: ActivityType;
  date?: number;
  status: ActivityStatus;
  cost: number;
  notes: string;
  attachments?: string[];
  metadata?: NonNullable<Activity['metadata']>;
}
