import { LatLngPoint } from '../../map/models/map.models';

export type CropStage =
  | 'Land Preparation'
  | 'Sowing'
  | 'Germination'
  | 'Vegetative Growth'
  | 'Flowering'
  | 'Fruiting / Pod Formation'
  | 'Maturity'
  | 'Harvest';

export type CropStatus = 'Active' | 'Completed' | 'Archived';

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
  | 'Weather Incident';

export type ActivityStatus = 'Planned' | 'Scheduled' | 'Completed' | 'Cancelled';

export interface CropEntity {
  id: string;
  fieldId: string; // e.g. "Field A", "Field B"
  name: string; // User-friendly name
  cropType: string; // e.g. "Soybeans", "Wheat", "Rice"
  area: number; // size value
  areaUnit: 'acres' | 'hectares';
  sowingDate?: number; // timestamp number
  currentStage: CropStage;
  status: CropStatus;
  expectedHarvestDate?: number; // timestamp number
  upcomingActivity?: string; // Quick dashboard note
}

export interface ActivityEntity {
  id: string;
  parentActivityId?: string;
  cropId: string;
  type: ActivityType;
  date?: number; // timestamp number
  status: ActivityStatus;
  cost: number; // in ₹
  notes: string;
  attachments: string[]; // Base64 image URLs or simulated files
  metadata: {
    // Irrigation specific
    irrigationMethod?: string; // e.g. "Drip", "Sprinkler", "Flood"
    duration?: number; // in minutes

    // Fertilizer specific
    fertilizerName?: string;
    quantity?: number; // in kg
    applicationMethod?: string; // e.g. "Broadcasting", "Foliar Spray"

    // Spray specific
    chemicalName?: string;
    dosage?: string; // e.g. "500 ml/acre"
    targetPest?: string; // e.g. "Aphids", "Whiteflies"

    // Shared fields
    waterQuantity?: number; // in liters (Irrigation & Spray)

    // Harvest specific
    yieldQuantity?: number;
    unit?: string; // e.g. "kg", "tons", "quintals"
    grade?: string; // e.g. "A", "B", "C"
    sellingPrice?: number; // in ₹ per unit
  };
}
