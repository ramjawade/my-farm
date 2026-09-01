import { Injectable, inject, computed } from '@angular/core';
import { Activity, ActivityExpense } from './farm-activity.models';
import { ActivityService } from '../activity/activity.service';

/**
 * Deprecated: FarmActivityService is now a thin wrapper around ActivityService.
 *
 * This maintains backward compatibility with existing components while the
 * codebase migrates to use ActivityService directly. New code should inject
 * ActivityService instead.
 *
 * TODO: Remove this wrapper once all components use ActivityService.
 */
@Injectable({
  providedIn: 'root',
})
export class FarmActivityService {
  private readonly activityService = inject(ActivityService);

  // Delegate to ActivityService
  readonly activities = this.activityService.activities;
  readonly expenses = this.activityService.expenses;

  // Re-export ActivityService methods with compatible signatures
  addActivity(
    activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> & { id?: string },
  ): Activity {
    return this.activityService.addActivity(activityData as any);
  }

  updateActivityOnly(id: string, updates: Partial<Activity>): void {
    this.activityService.updateActivity(id, updates);
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
    this.updateActivityOnly(id, updates);
  }

  deleteActivityOnly(id: string): void {
    this.activityService.deleteActivity(id);
  }

  deleteActivity(id: string): void {
    this.deleteActivityOnly(id);
  }

  getActivityById(id: string): Activity | undefined {
    return this.activityService.getActivityById(id);
  }

  getActivitiesForCrop(cropId: string): Activity[] {
    return this.activityService.getActivitiesForCrop(cropId);
  }

  // --- Expense API ---
  addExpense(expenseData: Omit<ActivityExpense, 'id' | 'createdAt'>): ActivityExpense {
    return this.activityService.addExpense(expenseData);
  }

  updateExpense(id: string, updates: Partial<ActivityExpense>): void {
    this.activityService.updateExpense(id, updates);
  }

  deleteExpense(id: string): void {
    this.activityService.deleteExpense(id);
  }

  getExpensesForActivity(activityId: string): ActivityExpense[] {
    return this.activityService.getExpensesForActivity(activityId);
  }

  getTotalExpenseForActivity(activityId: string): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }
}
