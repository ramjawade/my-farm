import { Activity, ActivityExpense, ActivityStatus } from '../../activity/activity.models';
import { logTiles, seasonByCategory } from './activity-log-summary';

// 10 Oct 2026 is in Kharif, which started on 1 Jun.
const NOW = new Date(2026, 9, 10).getTime();
const act = (id: number, status: ActivityStatus): Activity => ({ id, status }) as Activity;
const expense = (amount: number, categoryId: number, createdAt: number): ActivityExpense =>
  ({ id: amount, expenseCategoryId: categoryId, amount, createdAt }) as ActivityExpense;

describe('activity log summary', () => {
  it('counts done and planned activities and this season spend', () => {
    const tiles = logTiles(
      [
        act(1, 'Completed'),
        act(2, 'Completed'),
        act(3, 'Completed'),
        act(4, 'Scheduled'),
        act(5, 'Cancelled'),
      ],
      [
        expense(1500, 1, new Date(2026, 7, 1).getTime()),
        expense(500, 2, new Date(2026, 8, 1).getTime()),
        expense(9000, 1, new Date(2026, 0, 1).getTime()),
      ],
      NOW,
    );
    expect(tiles).toEqual({ seasonSpend: 2000, total: 5, done: 3, planned: 1 });
  });

  it('counts Draft and In Progress as planned', () => {
    const tiles = logTiles([act(1, 'Draft'), act(2, 'In Progress')], [], NOW);
    expect(tiles.planned).toBe(2);
    expect(tiles.seasonSpend).toBe(0);
  });

  it('adds this season up per category, biggest first', () => {
    const names: Record<number, string> = { 1: 'Fertilizer', 2: 'Labour' };
    const aug = new Date(2026, 7, 1).getTime();
    const rows = seasonByCategory(
      [
        expense(1000, 2, aug),
        expense(2000, 1, aug),
        expense(1000, 1, aug),
        expense(700, 2, new Date(2026, 0, 1).getTime()),
      ],
      (id) => names[id],
      NOW,
    );
    expect(rows).toEqual([
      { name: 'Fertilizer', amount: 3000 },
      { name: 'Labour', amount: 1000 },
    ]);
  });

  it('returns nothing when no expenses fall in the season', () => {
    expect(seasonByCategory([], () => '', NOW)).toEqual([]);
  });
});
