import { Activity, ActivityExpense } from '../../activity/activity.models';
import { seasonStart } from '../../home/home-summary';

export interface LogTiles {
  seasonSpend: number;
  total: number;
  done: number;
  planned: number;
}

/** The season's spend and the activity counts shown above the filters. */
export function logTiles(
  activities: Activity[],
  expenses: ActivityExpense[],
  now: number,
): LogTiles {
  const start = seasonStart(now);
  return {
    seasonSpend: expenses.filter((e) => e.createdAt >= start).reduce((sum, e) => sum + e.amount, 0),
    total: activities.length,
    done: activities.filter((a) => a.status === 'Completed').length,
    planned: activities.filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled').length,
  };
}

export interface CategorySpend {
  name: string;
  amount: number;
}

/** This season's expenses added up per category, the biggest first. */
export function seasonByCategory(
  expenses: ActivityExpense[],
  categoryName: (expenseCategoryId: number) => string,
  now: number,
): CategorySpend[] {
  const start = seasonStart(now);
  const byName = new Map<string, number>();
  for (const e of expenses) {
    if (e.createdAt < start) continue;
    const name = categoryName(e.expenseCategoryId);
    byName.set(name, (byName.get(name) ?? 0) + e.amount);
  }
  return [...byName.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}
