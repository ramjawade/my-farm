import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Activity, ActivityExpense, NewActivity, NewActivityExpense } from './activity.models';
import { IStorageService } from '../../core/storage/storage.interface';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly storage = inject(IStorageService);
  private readonly auth = inject(AuthService);

  private readonly activitiesSignal = signal<Activity[]>([]);
  private readonly expensesSignal = signal<ActivityExpense[]>([]);

  // Bumped on every load and every mutation so a load that resolves after a
  // later mutation (or a newer load) can detect it's stale and skip applying.
  private mutationGeneration = 0;

  readonly activities = this.activitiesSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();

  /** Total expense per activity id, recomputed whenever expenses change. */
  readonly costByActivity = computed(() => {
    const totals: Record<number, number> = {};
    for (const e of this.expensesSignal()) {
      totals[e.activityId] = (totals[e.activityId] || 0) + (e.amount || 0);
    }
    return totals;
  });

  /** Pending activities for today (not completed, with a date matching today). */
  readonly todaysPendingActivities = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.activitiesSignal().filter((a) => {
      if (!a.date) return false;
      const aStr = new Date(a.date).toISOString().split('T')[0];
      return aStr === todayStr && a.status !== 'Completed';
    });
  });

  constructor() {
    // Reload whenever the signed-in user changes (login, logout, session restore).
    effect(() => {
      this.auth.currentUser();
      this.loadFromStorage();
    });
  }

  private getCurrentUserId(): number {
    return this.auth.currentUser()?.id ?? 0;
  }

  /** Re-read the signed-in user's activities and expenses from storage. */
  reload(): Promise<void> {
    return this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    const generation = ++this.mutationGeneration;

    try {
      const userId = this.getCurrentUserId();
      const activities = await this.storage.getActivities(userId);
      if (generation === this.mutationGeneration) {
        this.activitiesSignal.set(activities);
      }
    } catch (e) {
      console.error('Failed to load activities', e);
    }

    try {
      const userId = this.getCurrentUserId();
      const expenses = await this.storage.getExpenses(userId);
      if (generation === this.mutationGeneration) {
        this.expensesSignal.set(expenses);
      }
    } catch (e) {
      console.error('Failed to load expenses', e);
    }
  }

  /** Saves the activity; resolves with the stored record carrying its server-minted id. */
  async addActivity(data: NewActivity): Promise<Activity> {
    this.mutationGeneration++;
    const saved = await this.storage.saveActivity(this.getCurrentUserId(), data);
    this.activitiesSignal.update((acts) =>
      acts.some((a) => a.id === saved.id) ? acts : [...acts, saved],
    );
    return saved;
  }

  updateActivity(id: number, updates: Partial<Activity>): void {
    this.mutationGeneration++;
    this.activitiesSignal.update((acts) =>
      acts.map((act) => (act.id === id ? { ...act, ...updates, updatedAt: Date.now() } : act)),
    );

    const userId = this.getCurrentUserId();
    this.storage.updateActivity(userId, id, updates).catch((err) => {
      console.error('Failed to update activity:', err);
      this.reload();
    });
  }

  deleteActivity(id: number): void {
    const userId = this.getCurrentUserId();
    const expensesForActivity = this.expensesSignal().filter((e) => e.activityId === id);

    this.mutationGeneration++;
    this.activitiesSignal.update((acts) => acts.filter((act) => act.id !== id));
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.activityId !== id));

    this.storage.deleteActivity(userId, id).catch((err) => {
      console.error('Failed to delete activity:', err);
      this.reload();
    });

    for (const expense of expensesForActivity) {
      this.storage.deleteExpense(userId, expense.id).catch((err) => {
        console.error('Failed to delete expense:', err);
        this.reload();
      });
    }
  }

  /** Remove every activity (and its expenses) linked to a crop. */
  deleteActivitiesForCrop(cropId: number): void {
    const ids = new Set(
      this.activitiesSignal()
        .filter((a) => a.cropId === cropId)
        .map((a) => a.id),
    );
    if (ids.size === 0) return;

    const userId = this.getCurrentUserId();
    this.mutationGeneration++;
    this.activitiesSignal.update((acts) => acts.filter((a) => !ids.has(a.id)));
    this.expensesSignal.update((exps) => exps.filter((e) => !ids.has(e.activityId)));

    for (const id of ids) {
      this.storage.deleteActivity(userId, id).catch((err) => {
        console.error('Failed to delete activity:', err);
        this.reload();
      });
    }
  }

  getActivityById(id: number): Activity | undefined {
    return this.activitiesSignal().find((act) => act.id === id);
  }

  getActivitiesForCrop(cropId: number): Activity[] {
    return this.activitiesSignal().filter((act) => act.cropId === cropId);
  }

  getActivitiesForField(fieldId: number): Activity[] {
    return this.activitiesSignal().filter((act) => act.fieldId === fieldId);
  }

  getSubActivities(parentActivityId: number): Activity[] {
    return this.activitiesSignal().filter((act) => act.parentActivityId === parentActivityId);
  }

  /** Saves the expense; resolves with the stored record carrying its server-minted id. */
  async addExpense(data: NewActivityExpense): Promise<ActivityExpense> {
    this.mutationGeneration++;
    const saved = await this.storage.saveExpense(this.getCurrentUserId(), data);
    this.expensesSignal.update((exps) =>
      exps.some((e) => e.id === saved.id) ? exps : [...exps, saved],
    );
    return saved;
  }

  updateExpense(id: number, updates: Partial<ActivityExpense>): void {
    this.mutationGeneration++;
    this.expensesSignal.update((exps) =>
      exps.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)),
    );

    const userId = this.getCurrentUserId();
    this.storage.updateExpense(userId, id, updates).catch((err) => {
      console.error('Failed to update expense:', err);
      this.reload();
    });
  }

  deleteExpense(id: number): void {
    this.mutationGeneration++;
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.id !== id));

    const userId = this.getCurrentUserId();
    this.storage.deleteExpense(userId, id).catch((err) => {
      console.error('Failed to delete expense:', err);
      this.reload();
    });
  }

  getExpensesForActivity(activityId: number): ActivityExpense[] {
    return this.expensesSignal().filter((exp) => exp.activityId === activityId);
  }

  getTotalExpenseForActivity(activityId: number): number {
    return this.getExpensesForActivity(activityId).reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }

  getExpensesByCategory(activityId: number): Record<string, number> {
    const expenses = this.getExpensesForActivity(activityId);
    return expenses.reduce(
      (acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + (exp.amount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
