import { ActivityStatus } from '../../activity/activity.models';

/** A Sale activity of a crop, as the crop page's Sales card shows it. `id` is the activity's id. */
export interface CropSale {
  id: number;
  cropId: number;
  /** When it was (or will be) sold, as a timestamp. */
  date?: number;
  status: ActivityStatus;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
  buyer?: string;
}
