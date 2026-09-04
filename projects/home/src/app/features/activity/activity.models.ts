import { Season } from '../../core/models/season';

export type ActivityType =
  | 'Sowing'
  | 'Irrigation'
  | 'Fertilizer Application'
  | 'Spray Application'
  | 'Weeding'
  | 'Field Inspection'
  | 'Labour Activity'
  | 'Harvest'
  | 'Sale'
  | 'Weather Incident'
  | 'Maintenance'
  | 'Custom';

export type ActivityStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Activity {
  id: string;
  parentActivityId?: string;

  // Timing
  date?: number; // timestamp; undefined = not yet scheduled
  season?: Season;

  // Links (both optional). When cropId is set, fieldId is derived from the crop's land
  // (see ActivityService.resolveFieldId) so an activity can never point at a land that
  // disagrees with its crop.
  cropId?: string; // Link to CropEntity
  fieldId?: string; // Link to SavedFarm

  // Activity definition
  type: ActivityType;
  customActivityName?: string; // Used when type === 'Custom'

  // Execution state
  status: ActivityStatus;
  notes?: string;
  attachments?: string[]; // Base64 images

  // Type-specific metadata (optional)
  metadata?: {
    // Irrigation
    irrigationMethod?: string; // 'Drip' | 'Sprinkler' | 'Flood'
    waterQuantity?: number; // liters
    duration?: number; // minutes

    // Fertilizer/Spray
    fertilizerName?: string;
    chemicalName?: string;
    quantity?: number; // kg or liters
    dosage?: string;
    applicationMethod?: string;
    targetPest?: string;

    // Harvest
    yieldQuantity?: number;
    yieldUnit?: string; // kg, quintals, tons
    unit?: string; // legacy alias of yieldUnit
    grade?: string; // A, B, C
    sellingPrice?: number; // per unit

    // Generic
    [key: string]: any;
  };

  // Audit
  createdAt: number;
  updatedAt: number;
}

export interface ActivityExpense {
  id: string;
  activityId: string;
  category: string; // Machine Rent, Labour, Seeds, Fertilizer, Transport, etc.
  itemId?: string;
  resourceId?: string;
  quantity?: number;
  unit?: string; // hours, days, bags, litres
  rate?: number;
  amount: number;
  remarks?: string;
  createdAt: number;
}
