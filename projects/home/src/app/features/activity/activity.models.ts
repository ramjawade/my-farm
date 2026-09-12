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

export type ExpenseCategory =
  | 'Machine Rent'
  | 'Labour'
  | 'Seeds'
  | 'Fertilizer'
  | 'Pesticide'
  | 'Transport'
  | 'Water'
  | 'Equipment'
  | 'Fuel'
  | 'Other';

export interface Activity {
  id: number;
  parentActivityId?: number;

  // Timing
  date?: number; // timestamp; undefined = not yet scheduled
  season?: Season;

  // Links (both optional). When cropId is set, fieldId is derived from the crop's land
  // (see ActivityService.resolveFieldId) so an activity can never point at a land that
  // disagrees with its crop.
  cropId?: number; // Link to CropEntity
  fieldId?: number; // Link to SavedFarm

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

/** An activity before it is saved — the backend mints `id` and the audit timestamps. */
export type NewActivity = Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>;

export interface ActivityExpense {
  id: number;
  activityId: number;
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

export type NewActivityExpense = Omit<ActivityExpense, 'id' | 'createdAt'>;

/** KPI counts + total expense from `GET /api/v1/activities/summary`. */
export interface ActivityKpiSummary {
  total: number;
  completed: number;
  inProgress: number;
  totalExpense: number;
}

/** A single audit-trail entry for one activity — GET /activities/{id}/history. */
export interface ActivityHistoryEntry {
  id: number;
  activityId: number;
  eventType: string;
  detail?: Record<string, unknown>;
  createdAt: number;
}

/** Per-activity KPI summary — GET /activities/{id}/summary. */
export interface ActivityDetailSummary {
  totalExpense: number;
  expenseCount: number;
  daysSinceCreated: number;
  status: ActivityStatus;
}
