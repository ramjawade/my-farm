import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Activity, ActivityExpense } from './activity.models';
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
    const totals: Record<string, number> = {};
    for (const e of this.expensesSignal()) {
      totals[e.activityId] = (totals[e.activityId] || 0) + (e.amount || 0);
    }
    return totals;
  });

  constructor() {
    // Reload whenever the signed-in user changes (login, logout, session restore).
    effect(() => {
      this.auth.currentUser();
      this.loadFromStorage();
    });
  }

  private getCurrentUserId(): string {
    const user = this.auth.currentUser();
    return user?.id || 'anonymous';
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


  addActivity(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Activity {
    const now = Date.now();
    const activity: Activity = {
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    this.mutationGeneration++;
    this.activitiesSignal.update((acts) => [...acts, activity]);

    const userId = this.getCurrentUserId();
    this.storage.saveActivity(userId, activity).catch((err) => {
      console.error('Failed to save activity:', err);
      this.reload();
    });

    return activity;
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
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

  deleteActivity(id: string): void {
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
  deleteActivitiesForCrop(cropId: string): void {
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

  getActivityById(id: string): Activity | undefined {
    return this.activitiesSignal().find((act) => act.id === id);
  }

  getActivitiesForCrop(cropId: string): Activity[] {
    return this.activitiesSignal().filter((act) => act.cropId === cropId);
  }

  getActivitiesForField(fieldId: string): Activity[] {
    return this.activitiesSignal().filter((act) => act.fieldId === fieldId);
  }

  getSubActivities(parentActivityId: string): Activity[] {
    return this.activitiesSignal().filter((act) => act.parentActivityId === parentActivityId);
  }

  addExpense(data: Omit<ActivityExpense, 'id' | 'createdAt'>): ActivityExpense {
    const expense: ActivityExpense = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    this.mutationGeneration++;
    this.expensesSignal.update((exps) => [...exps, expense]);

    const userId = this.getCurrentUserId();
    this.storage.saveExpense(userId, expense).catch((err) => {
      console.error('Failed to save expense:', err);
      this.reload();
    });

    return expense;
  }

  updateExpense(id: string, updates: Partial<ActivityExpense>): void {
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

  deleteExpense(id: string): void {
    this.mutationGeneration++;
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.id !== id));

    const userId = this.getCurrentUserId();
    this.storage.deleteExpense(userId, id).catch((err) => {
      console.error('Failed to delete expense:', err);
      this.reload();
    });
  }

  getExpensesForActivity(activityId: string): ActivityExpense[] {
    return this.expensesSignal().filter((exp) => exp.activityId === activityId);
  }

  getTotalExpenseForActivity(activityId: string): number {
    return this.getExpensesForActivity(activityId).reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }

  getExpensesByCategory(activityId: string): Record<string, number> {
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
