import { Injectable } from '@angular/core';
import {
  Activity,
  ActivityExpense,
  NewActivity,
  NewActivityExpense,
} from '../features/activity/activity.models';

/**
 * `ActivitiesApiService` backed by plain in-memory arrays — no HTTP. Seed it
 * directly via the public arrays before a test runs. Like the backend,
 * `save*` mints the numeric id.
 */
@Injectable()
export class FakeActivitiesApiService {
  activities: Activity[] = [];
  expenses: ActivityExpense[] = [];

  private nextId = 1000;

  async getActivities(): Promise<Activity[]> {
    return [...this.activities];
  }
  async getExpenses(): Promise<ActivityExpense[]> {
    return [...this.expenses];
  }
  async saveActivity(_userId: number, activity: NewActivity): Promise<Activity> {
    const now = Date.now();
    const saved: Activity = { ...activity, id: this.nextId++, createdAt: now, updatedAt: now };
    this.activities.push(saved);
    return saved;
  }
  async saveExpense(_userId: number, expense: NewActivityExpense): Promise<ActivityExpense> {
    const saved: ActivityExpense = { ...expense, id: this.nextId++, createdAt: Date.now() };
    this.expenses.push(saved);
    return saved;
  }
  async updateActivity(_userId: number, id: number, updates: Partial<Activity>): Promise<void> {
    this.activities = this.activities.map((a) => (a.id === id ? { ...a, ...updates } : a));
  }
  async updateExpense(
    _userId: number,
    id: number,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e));
  }
  async deleteActivity(_userId: number, id: number): Promise<void> {
    this.activities = this.activities.filter((a) => a.id !== id);
  }
  async deleteExpense(_userId: number, id: number): Promise<void> {
    this.expenses = this.expenses.filter((e) => e.id !== id);
  }
  async syncActivitiesForField(_userId: number, fieldId: number): Promise<Activity[]> {
    return this.activities.filter((a) => a.fieldId === fieldId);
  }
  async syncExpensesForActivity(_userId: number, activityId: number): Promise<ActivityExpense[]> {
    return this.expenses.filter((e) => e.activityId === activityId);
  }
}
