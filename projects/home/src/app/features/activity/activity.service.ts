import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { Activity, ActivityExpense } from './activity.models';
import { IStorageService } from '../../core/storage/storage.interface';
import { AuthService } from '../../core/auth/auth.service';

// Emitted synchronously whenever an activity (or its expenses/cost) changes,
// so other services (e.g. CropTimelineService) can mirror the change without
// ActivityService depending on them — avoids a circular DI dependency.
export interface ActivityChangeEvent {
  type: 'upsert' | 'delete';
  id: string;
  activity?: Activity;
  cost?: number;
}

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

  private readonly changesSubject = new Subject<ActivityChangeEvent>();
  readonly changes$ = this.changesSubject.asObservable();

  readonly activities = this.activitiesSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  private getCurrentUserId(): string {
    const user = this.auth.currentUser();
    return user?.id || 'anonymous';
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

  private persistActivities(): void {
    const userId = this.getCurrentUserId();
    const activities = this.activitiesSignal();
    this.storage.getActivities(userId).then((stored) => {
      // Replace all stored activities with current signal state
      const toDelete = stored.filter((s) => !activities.find((a) => a.id === s.id));
      const toAdd = activities.filter((a) => !stored.find((s) => s.id === a.id));
      const toUpdate = activities.filter((a) => stored.find((s) => s.id === a.id));

      toDelete.forEach((a) => this.storage.deleteActivity(userId, a.id));
      toAdd.forEach((a) => this.storage.saveActivity(userId, a));
      toUpdate.forEach((a) => this.storage.updateActivity(userId, a.id, a));
    });
  }

  private persistExpenses(): void {
    const userId = this.getCurrentUserId();
    const expenses = this.expensesSignal();
    this.storage.getExpenses(userId).then((stored) => {
      const toDelete = stored.filter((s) => !expenses.find((e) => e.id === s.id));
      const toAdd = expenses.filter((e) => !stored.find((s) => s.id === e.id));
      const toUpdate = expenses.filter((e) => stored.find((s) => s.id === e.id));

      toDelete.forEach((e) => this.storage.deleteExpense(userId, e.id));
      toAdd.forEach((e) => this.storage.saveExpense(userId, e));
      toUpdate.forEach((e) => this.storage.updateExpense(userId, e.id, e));
    });
  }

  addActivity(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Activity {
    const now = Date.now();
    const activity: Activity = {
      ...data,
      id: data.id || `activity_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.mutationGeneration++;
    this.activitiesSignal.update((acts) => [...acts, activity]);
    this.persistActivities();
    this.emitUpsert(activity);
    return activity;
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
    this.mutationGeneration++;
    this.activitiesSignal.update((acts) =>
      acts.map((act) => (act.id === id ? { ...act, ...updates, updatedAt: Date.now() } : act)),
    );
    this.persistActivities();
    const updated = this.getActivityById(id);
    if (updated) this.emitUpsert(updated);
  }

  deleteActivity(id: string): void {
    this.mutationGeneration++;
    this.activitiesSignal.update((acts) => acts.filter((act) => act.id !== id));
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.activityId !== id));
    this.persistActivities();
    this.persistExpenses();
    this.changesSubject.next({ type: 'delete', id });
  }

  private emitUpsert(activity: Activity): void {
    this.changesSubject.next({
      type: 'upsert',
      id: activity.id,
      activity,
      cost: this.getTotalExpenseForActivity(activity.id),
    });
  }

  private emitCostChange(activityId: string): void {
    const activity = this.getActivityById(activityId);
    if (activity) this.emitUpsert(activity);
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
      id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };

    this.mutationGeneration++;
    this.expensesSignal.update((exps) => [...exps, expense]);
    this.persistExpenses();
    this.emitCostChange(expense.activityId);
    return expense;
  }

  updateExpense(id: string, updates: Partial<ActivityExpense>): void {
    this.mutationGeneration++;
    const activityId = this.expensesSignal().find((exp) => exp.id === id)?.activityId;
    this.expensesSignal.update((exps) =>
      exps.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)),
    );
    this.persistExpenses();
    if (activityId) this.emitCostChange(activityId);
  }

  deleteExpense(id: string): void {
    this.mutationGeneration++;
    const activityId = this.expensesSignal().find((exp) => exp.id === id)?.activityId;
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.id !== id));
    this.persistExpenses();
    if (activityId) this.emitCostChange(activityId);
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
