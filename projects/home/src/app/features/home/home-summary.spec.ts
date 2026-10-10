import { Activity, ActivityExpense } from '../activity/activity.models';
import { CropEntity } from '../crop-timeline/crop-timeline.models';
import { SavedFarm } from '../../map/models/map.models';
import {
  attentionItems,
  dayDiff,
  greetingFor,
  keyTiles,
  nextHarvest,
  seasonStart,
  todayItems,
} from './home-summary';

// Thursday 1 October 2026, 10:30 local time
const NOW = new Date(2026, 9, 1, 10, 30).getTime();
const at = (days: number, hour = 9): number => new Date(2026, 9, 1 + days, hour).getTime();

const activity = (
  id: number,
  status: Activity['status'],
  days: number,
  cropId?: number,
): Activity => ({ id, status, date: at(days), cropId, activityTypeId: id }) as Activity;

const crop = (id: number, extra: Partial<CropEntity> = {}): CropEntity =>
  ({
    id,
    fieldId: 1,
    name: 'Onion',
    status: 'Active',
    currentStage: 'Sowing',
    sowingDate: at(-30),
    ...extra,
  }) as CropEntity;

const land = (acres: number): SavedFarm =>
  ({
    id: 1,
    name: 'L',
    points: [],
    area: { squareMeters: 0, hectares: 0, acres },
  }) as unknown as SavedFarm;

describe('home summary', () => {
  describe('greetingFor', () => {
    it('picks morning, afternoon or evening', () => {
      expect(greetingFor(5)).toBe('morning');
      expect(greetingFor(11)).toBe('morning');
      expect(greetingFor(12)).toBe('afternoon');
      expect(greetingFor(16)).toBe('afternoon');
      expect(greetingFor(17)).toBe('evening');
      expect(greetingFor(23)).toBe('evening');
    });
  });

  describe('dayDiff and seasonStart', () => {
    it('counts calendar days, ignoring the time of day', () => {
      expect(dayDiff(at(0, 23), at(0, 1))).toBe(0);
      expect(dayDiff(at(1, 0), at(0, 23))).toBe(1);
      expect(dayDiff(at(-2), NOW)).toBe(-2);
    });

    it('starts Kharif on 1 June, Zaid on 1 April and Rabi on 1 November', () => {
      expect(new Date(seasonStart(NOW)).toDateString()).toBe(new Date(2026, 5, 1).toDateString());
      expect(seasonStart(new Date(2026, 3, 20).getTime())).toBe(new Date(2026, 3, 1).getTime());
      expect(seasonStart(new Date(2026, 11, 5).getTime())).toBe(new Date(2026, 10, 1).getTime());
      expect(seasonStart(new Date(2027, 1, 5).getTime())).toBe(new Date(2026, 10, 1).getTime());
    });
  });

  describe('nextHarvest', () => {
    it('finds the nearest harvest today or later among active crops', () => {
      const crops = [
        crop(1, { expectedHarvestDate: at(20) }),
        crop(2, { expectedHarvestDate: at(6), name: 'Tomato' }),
        crop(3, { expectedHarvestDate: at(-3) }),
        crop(4, { expectedHarvestDate: at(2), status: 'Completed' }),
      ];
      const next = nextHarvest(crops, NOW);
      expect(next?.days).toBe(6);
      expect(next?.crop.name).toBe('Tomato');
    });

    it('returns null when no crop has a harvest date', () => {
      expect(nextHarvest([crop(1)], NOW)).toBeNull();
    });
  });

  describe('keyTiles', () => {
    it("counts active crops, sums area and sums this season's expenses only", () => {
      const expenses = [
        { amount: 5000, createdAt: at(-10) },
        { amount: 7000, createdAt: at(-20) },
        { amount: 900, createdAt: new Date(2026, 2, 1).getTime() },
      ] as ActivityExpense[];
      const tiles = keyTiles(
        [crop(1), crop(2), crop(3, { status: 'Archived' })],
        [land(2), land(3.5)],
        expenses,
        NOW,
      );
      expect(tiles.activeCrops).toBe(2);
      expect(tiles.landsCount).toBe(2);
      expect(tiles.totalAcres).toBeCloseTo(5.5);
      expect(tiles.seasonSpend).toBe(12000);
      expect(tiles.nextHarvest).toBeNull();
    });
  });

  describe('attentionItems', () => {
    it('lists overdue first, then due soon, and ignores later or finished ones', () => {
      const items = attentionItems(
        [
          activity(1, 'Scheduled', 2),
          activity(2, 'Scheduled', -2),
          activity(3, 'Draft', 0),
          activity(4, 'Scheduled', 3),
          activity(5, 'Completed', -1),
          activity(6, 'Cancelled', -1),
        ],
        [],
        NOW,
      );
      expect(items.map((i) => i.activity?.id)).toEqual([2, 3, 1]);
      expect(items[0].badge).toEqual({ kind: 'overdue', days: 2 });
      expect(items[0].tone).toBe('danger');
      expect(items[1].badge).toEqual({ kind: 'today' });
      expect(items[2].badge).toEqual({ kind: 'in2days' });
      expect(items[2].tone).toBe('warning');
    });

    it('marks tomorrow', () => {
      expect(attentionItems([activity(1, 'Scheduled', 1)], [], NOW)[0].badge).toEqual({
        kind: 'tomorrow',
      });
    });

    it('flags a crop idle for 7 days or more, counted from the last completed activity', () => {
      const items = attentionItems([activity(1, 'Completed', -9, 5)], [crop(5)], NOW);
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('crop');
      expect(items[0].badge).toEqual({ kind: 'idle', days: 9 });
      expect(items[0].lastDone).toBe(at(-9));
    });

    it('counts from sowing when nothing was done, and skips a recently active crop', () => {
      expect(attentionItems([], [crop(5, { sowingDate: at(-12) })], NOW)[0].badge).toEqual({
        kind: 'idle',
        days: 12,
      });
      expect(attentionItems([activity(1, 'Completed', -3, 5)], [crop(5)], NOW)).toEqual([]);
      expect(attentionItems([], [crop(5, { sowingDate: at(-6) })], NOW)).toEqual([]);
    });

    it('puts due work before idle crops and caps the list at four', () => {
      const activities = [1, 2, 3, 4, 5].map((n) => activity(n, 'Scheduled', 0));
      const items = attentionItems(activities, [crop(9)], NOW);
      expect(items.length).toBe(4);
      expect(items.every((i) => i.type === 'activity')).toBeTrue();
    });

    it('is empty when nothing needs attention', () => {
      expect(attentionItems([], [], NOW)).toEqual([]);
    });
  });

  describe('todayItems', () => {
    it("lists today's activities with done flags, without cancelled or other days", () => {
      const items = todayItems(
        [
          activity(1, 'Scheduled', 0),
          activity(2, 'Completed', 0),
          activity(3, 'Cancelled', 0),
          activity(4, 'Scheduled', 1),
          activity(5, 'Scheduled', -1),
        ],
        NOW,
      );
      expect(items.map((i) => [i.activity.id, i.done])).toEqual([
        [1, false],
        [2, true],
      ]);
    });
  });
});
