import { ActivityType } from '../crop-timeline/crop-timeline.models';
import { ExpenseCategory } from './activity.models';

/** Icon class for activity type (Bootstrap icon). */
export function activityTypeIcon(type: ActivityType): string {
  switch (type) {
    case 'Sowing':
      return 'bi-seedling';
    case 'Irrigation':
      return 'bi-droplet-half';
    case 'Fertilizer Application':
      return 'bi-box-seam';
    case 'Spray Application':
      return 'bi-wind';
    case 'Weeding':
      return 'bi-scissors';
    case 'Field Inspection':
      return 'bi-eye-fill';
    case 'Labour Activity':
      return 'bi-people-fill';
    case 'Harvest':
      return 'bi-flower3';
    case 'Sale':
      return 'bi-cash-coin';
    case 'Weather Incident':
      return 'bi-lightning-charge-fill';
    default:
      return 'bi-calendar-event';
  }
}

/** Emoji for activity type. */
export function activityTypeEmoji(type: ActivityType): string {
  switch (type) {
    case 'Sowing':
      return '🌱';
    case 'Irrigation':
      return '💧';
    case 'Fertilizer Application':
      return '🌿';
    case 'Spray Application':
      return '🐛';
    case 'Weeding':
      return '✂️';
    case 'Field Inspection':
      return '📷';
    case 'Labour Activity':
      return '👥';
    case 'Harvest':
      return '🌾';
    case 'Sale':
      return '💰';
    case 'Weather Incident':
      return '⚡';
    default:
      return '📅';
  }
}

/** Design token (CSS custom property) holding the colour for an activity type. */
export function activityTypeColorToken(type: ActivityType): string {
  switch (type) {
    case 'Sowing':
      return '--mf-type-sowing';
    case 'Irrigation':
      return '--mf-type-irrigation';
    case 'Fertilizer Application':
      return '--mf-type-fertilizer';
    case 'Spray Application':
      return '--mf-type-spray';
    case 'Weeding':
      return '--mf-type-weeding';
    case 'Field Inspection':
      return '--mf-type-inspection';
    case 'Labour Activity':
      return '--mf-type-labour';
    case 'Harvest':
      return '--mf-type-harvest';
    case 'Sale':
      return '--mf-type-sale';
    case 'Weather Incident':
      return '--mf-type-weather';
    default:
      return '--mf-type-custom';
  }
}

/** CSS colour value for an activity type, e.g. for a style binding. */
export function activityTypeColor(type: ActivityType): string {
  return `var(${activityTypeColorToken(type)})`;
}

/** Icon class for expense category (Bootstrap icon). */
export function expenseCategoryIcon(category: ExpenseCategory): string {
  switch (category) {
    case 'Seeds':
      return 'bi-seedling';
    case 'Fertilizer':
      return 'bi-box-seam';
    case 'Pesticide':
      return 'bi-wind';
    case 'Labour':
      return 'bi-people-fill';
    case 'Water':
      return 'bi-droplet-half';
    case 'Equipment':
      return 'bi-tools';
    case 'Fuel':
      return 'bi-fuel-pump';
    case 'Transport':
      return 'bi-truck';
    case 'Machine Rent':
      return 'bi-tools';
    case 'Other':
      return 'bi-question-circle';
    default:
      return 'bi-tag';
  }
}
