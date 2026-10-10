import { seasonForDate } from '../../core/models/season';
import { Activity, ActivityExpense } from '../activity/activity.models';
import { CropEntity } from '../crop-timeline/crop-timeline.models';
import { SavedFarm } from '../../map/models/map.models';

const ONE_DAY = 24 * 60 * 60 * 1000;
/** Activities due within this many days (or overdue) need attention. */
const DUE_SOON_DAYS = 2;
/** A crop with no completed activity for this many days needs attention. */
const IDLE_DAYS = 7;
export const MAX_ATTENTION_ITEMS = 4;

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

export function greetingFor(hour: number): GreetingPeriod {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const startOfDay = (time: number): number => {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days from `now` to `time` (negative when in the past). */
export function dayDiff(time: number, now: number): number {
  return Math.round((startOfDay(time) - startOfDay(now)) / ONE_DAY);
}

/** First day of the cropping season `now` falls in (Kharif 1 Jun, Rabi 1 Nov, Zaid 1 Apr). */
export function seasonStart(now: number): number {
  const date = new Date(now);
  const year = date.getFullYear();
  switch (seasonForDate(date)) {
    case 'Kharif':
      return new Date(year, 5, 1).getTime();
    case 'Zaid':
      return new Date(year, 3, 1).getTime();
    default:
      return new Date(date.getMonth() >= 10 ? year : year - 1, 10, 1).getTime();
  }
}

export interface NextHarvest {
  days: number;
  crop: CropEntity;
}

/** The active crop with the nearest expected harvest today or later, if any. */
export function nextHarvest(crops: CropEntity[], now: number): NextHarvest | null {
  let best: NextHarvest | null = null;
  for (const crop of crops) {
    if (crop.status !== 'Active' || !crop.expectedHarvestDate) continue;
    const days = dayDiff(crop.expectedHarvestDate, now);
    if (days < 0) continue;
    if (!best || days < best.days) best = { days, crop };
  }
  return best;
}

export interface KeyTiles {
  activeCrops: number;
  landsCount: number;
  totalAcres: number;
  seasonSpend: number;
  seasonStart: number;
  nextHarvest: NextHarvest | null;
}

export function keyTiles(
  crops: CropEntity[],
  lands: SavedFarm[],
  expenses: ActivityExpense[],
  now: number,
): KeyTiles {
  const start = seasonStart(now);
  return {
    activeCrops: crops.filter((c) => c.status === 'Active').length,
    landsCount: lands.length,
    totalAcres: lands.reduce((sum, land) => sum + land.area.acres, 0),
    seasonSpend: expenses.filter((e) => e.createdAt >= start).reduce((sum, e) => sum + e.amount, 0),
    seasonStart: start,
    nextHarvest: nextHarvest(crops, now),
  };
}

export type AttentionBadge =
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'in2days' }
  | { kind: 'idle'; days: number };

export interface AttentionItem {
  type: 'activity' | 'crop';
  badge: AttentionBadge;
  tone: 'danger' | 'warning' | 'neutral';
  activity?: Activity;
  crop?: CropEntity;
  /** When the crop last had a completed activity; undefined means counted from sowing. */
  lastDone?: number;
  /** Lower sorts first. */
  order: number;
}

const isOpen = (a: Activity): boolean => a.status !== 'Completed' && a.status !== 'Cancelled';

/** Overdue or soon-due activities and idle crops, most urgent first, at most four. */
export function attentionItems(
  activities: Activity[],
  crops: CropEntity[],
  now: number,
  limit = MAX_ATTENTION_ITEMS,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const activity of activities) {
    if (!isOpen(activity) || !activity.date) continue;
    const diff = dayDiff(activity.date, now);
    if (diff > DUE_SOON_DAYS) continue;
    const badge: AttentionBadge =
      diff < 0
        ? { kind: 'overdue', days: -diff }
        : diff === 0
          ? { kind: 'today' }
          : diff === 1
            ? { kind: 'tomorrow' }
            : { kind: 'in2days' };
    items.push({
      type: 'activity',
      badge,
      tone: diff < 0 ? 'danger' : 'warning',
      activity,
      order: diff,
    });
  }

  for (const crop of crops) {
    if (crop.status !== 'Active') continue;
    const lastDone = activities
      .filter((a) => a.cropId === crop.id && a.status === 'Completed' && a.date)
      .reduce<number | undefined>(
        (max, a) => (max === undefined || a.date! > max ? a.date : max),
        undefined,
      );
    const since = lastDone ?? crop.sowingDate;
    if (!since) continue;
    const idle = -dayDiff(since, now);
    if (idle < IDLE_DAYS) continue;
    items.push({
      type: 'crop',
      badge: { kind: 'idle', days: idle },
      tone: 'neutral',
      crop,
      lastDone,
      order: 100 - idle,
    });
  }

  return items.sort((a, b) => a.order - b.order).slice(0, limit);
}

export interface TodayItem {
  activity: Activity;
  done: boolean;
}

/** Activities dated today, other than cancelled ones, with whether each is done. */
export function todayItems(activities: Activity[], now: number): TodayItem[] {
  return activities
    .filter((a) => a.date && a.status !== 'Cancelled' && dayDiff(a.date, now) === 0)
    .map((activity) => ({ activity, done: activity.status === 'Completed' }));
}
