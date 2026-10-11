import { ActivityStatus } from './activity.models';

/** The status a new activity starts with, from its date: later than today is Scheduled. */
export function statusForDate(date: string, today: string): ActivityStatus {
  return date > today ? 'Scheduled' : 'Completed';
}

export interface ActivityActions {
  markDone: boolean;
  start: boolean;
  restore: boolean;
  cancel: boolean;
}

/** The status buttons an activity offers; Edit and Delete are always available. */
export function allowedActions(status: ActivityStatus): ActivityActions {
  const open = status !== 'Completed' && status !== 'Cancelled';
  return {
    markDone: open,
    start: status === 'Draft' || status === 'Scheduled',
    restore: status === 'Cancelled',
    cancel: open,
  };
}

/** Bootstrap colour name for a status badge. */
export function activityStatusTone(status: ActivityStatus): string {
  switch (status) {
    case 'Scheduled':
      return 'info';
    case 'In Progress':
      return 'warning';
    case 'Completed':
      return 'success';
    case 'Cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
}

/** Translation key of a status name. */
export function activityStatusKey(status: ActivityStatus): string {
  return 'status.' + status.toLowerCase().replace(' ', '_');
}
