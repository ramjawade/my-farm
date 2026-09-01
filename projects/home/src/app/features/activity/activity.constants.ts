import { ActivityType, ActivityStatus } from './activity.models';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  Sowing: 'Sowing',
  Irrigation: 'Irrigation',
  'Fertilizer Application': 'Fertilizer Application',
  'Spray Application': 'Spray Application',
  Weeding: 'Weeding',
  'Field Inspection': 'Field Inspection',
  'Labour Activity': 'Labour Activity',
  Harvest: 'Harvest',
  Sale: 'Sale',
  'Weather Incident': 'Weather Incident',
  Maintenance: 'Maintenance',
  Custom: 'Other (custom)',
};

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => ({
  value: key as ActivityType,
  label,
}));

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  Draft: 'Draft',
  Scheduled: 'Scheduled',
  'In Progress': 'In Progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export const ACTIVITY_STATUS_OPTIONS = Object.entries(ACTIVITY_STATUS_LABELS).map(([key, label]) => ({
  value: key as ActivityStatus,
  label,
}));

export const EXPENSE_CATEGORIES = [
  'Machine Rent',
  'Labour',
  'Seeds',
  'Fertilizer',
  'Pesticide',
  'Transport',
  'Fuel',
  'Equipment',
  'Water',
  'Other',
];
