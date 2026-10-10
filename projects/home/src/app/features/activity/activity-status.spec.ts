import { ActivityStatus } from './activity.models';
import {
  activityStatusKey,
  activityStatusTone,
  allowedActions,
  statusForDate,
} from './activity-status';

describe('activity status helpers', () => {
  it('schedules a later date and completes today or earlier', () => {
    expect(statusForDate('2026-10-12', '2026-10-10')).toBe('Scheduled');
    expect(statusForDate('2026-10-10', '2026-10-10')).toBe('Completed');
    expect(statusForDate('2026-10-01', '2026-10-10')).toBe('Completed');
  });

  it('offers the buttons that fit each status', () => {
    const buttons = (s: ActivityStatus) =>
      Object.entries(allowedActions(s))
        .filter(([, on]) => on)
        .map(([name]) => name);
    expect(buttons('Draft')).toEqual(['markDone', 'start', 'cancel']);
    expect(buttons('Scheduled')).toEqual(['markDone', 'start', 'cancel']);
    expect(buttons('In Progress')).toEqual(['markDone', 'cancel']);
    expect(buttons('Completed')).toEqual([]);
    expect(buttons('Cancelled')).toEqual(['restore']);
  });

  it('maps statuses to badge tones and translation keys', () => {
    expect(activityStatusTone('Draft')).toBe('secondary');
    expect(activityStatusTone('Scheduled')).toBe('info');
    expect(activityStatusTone('In Progress')).toBe('warning');
    expect(activityStatusTone('Completed')).toBe('success');
    expect(activityStatusTone('Cancelled')).toBe('danger');
    expect(activityStatusKey('In Progress')).toBe('status.in_progress');
    expect(activityStatusKey('Cancelled')).toBe('status.cancelled');
  });
});
