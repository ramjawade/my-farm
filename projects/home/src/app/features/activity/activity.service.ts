import { Injectable, signal, computed } from '@angular/core';
import { Activity, ActivityExpense } from './activity.models';

const ACTIVITIES_KEY = 'my_farm_activities';
const EXPENSES_KEY = 'my_farm_activity_expenses';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly activitiesSignal = signal<Activity[]>([]);
  private readonly expensesSignal = signal<ActivityExpense[]>([]);

  readonly activities = this.activitiesSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(ACTIVITIES_KEY);
      if (stored) {
        this.activitiesSignal.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load activities', e);
    }

    try {
      const stored = localStorage.getItem(EXPENSES_KEY);
      if (stored) {
        this.expensesSignal.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load expenses', e);
    }
  }

  private saveActivitiesToStorage(): void {
    try {
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(this.activitiesSignal()));
    } catch (e) {
      console.error('Failed to save activities', e);
    }
  }

  private saveExpensesToStorage(): void {
    try {
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(this.expensesSignal()));
    } catch (e) {
      console.error('Failed to save expenses', e);
    }
  }

  addActivity(
    data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>
  ): Activity {
    const now = Date.now();
    const activity: Activity = {
      ...data,
      id: `activity_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.activitiesSignal.update((acts) => [...acts, activity]);
    this.saveActivitiesToStorage();
    return activity;
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
    this.activitiesSignal.update((acts) =>
      acts.map((act) =>
        act.id === id
          ? { ...act, ...updates, updatedAt: Date.now() }
          : act
      )
    );
    this.saveActivitiesToStorage();
  }

  deleteActivity(id: string): void {
    this.activitiesSignal.update((acts) => acts.filter((act) => act.id !== id));
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.activityId !== id));
    this.saveActivitiesToStorage();
    this.saveExpensesToStorage();
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

  addExpense(
    data: Omit<ActivityExpense, 'id' | 'createdAt'>
  ): ActivityExpense {
    const expense: ActivityExpense = {
      ...data,
      id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };

    this.expensesSignal.update((exps) => [...exps, expense]);
    this.saveExpensesToStorage();
    return expense;
  }

  updateExpense(id: string, updates: Partial<ActivityExpense>): void {
    this.expensesSignal.update((exps) =>
      exps.map((exp) =>
        exp.id === id
          ? { ...exp, ...updates }
          : exp
      )
    );
    this.saveExpensesToStorage();
  }

  deleteExpense(id: string): void {
    this.expensesSignal.update((exps) => exps.filter((exp) => exp.id !== id));
    this.saveExpensesToStorage();
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
      {} as Record<string, number>
    );
  }
}
