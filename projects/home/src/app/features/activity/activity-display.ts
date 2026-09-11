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

/** Hex color for activity type. */
export function activityTypeColor(type: ActivityType): string {
  switch (type) {
    case 'Sowing':
      return '#38a169';
    case 'Irrigation':
      return '#3182ce';
    case 'Fertilizer Application':
      return '#805ad5';
    case 'Spray Application':
      return '#e53e3e';
    case 'Weeding':
      return '#dd6b20';
    case 'Field Inspection':
      return '#319795';
    case 'Labour Activity':
      return '#4a5568';
    case 'Harvest':
      return '#d69e2e';
    case 'Sale':
      return '#38a169';
    case 'Weather Incident':
      return '#e53e3e';
    default:
      return '#4a5568';
  }
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
