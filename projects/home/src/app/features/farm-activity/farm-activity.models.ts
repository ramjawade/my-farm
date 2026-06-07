export type ActivityStatus = 'Draft' | 'In Progress' | 'Completed';

export interface Activity {
  id: string;
  date: string; // YYYY-MM-DD
  season: string; // 'Kharif' | 'Rabi' | 'Summer' | etc.
  activityId: string; // The type/name of activity, e.g., 'Bore Installation', 'Sowing'
  cropId?: string; // Optional link to CropEntity
  fieldId?: string; // Optional link to SavedFarm
  status: ActivityStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityExpense {
  id: string;
  activityId: string; // Link to Activity.id
  category: string; // e.g., 'Machine Rent', 'Workers', 'Transport', 'Seeds', 'Fertilizer'
  itemId?: string;
  resourceId?: string;
  quantity?: number;
  unit?: string; // e.g., 'hours', 'days', 'bags', 'litres'
  rate?: number;
  amount: number; // calculated as quantity * rate or entered manually
  remarks?: string;
  createdAt: number;
}
