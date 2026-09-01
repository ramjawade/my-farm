import { Activity, ActivityExpense } from '../../features/activity/activity.models';

export abstract class IStorageService {
  abstract getActivities(userId: string): Promise<Activity[]>;
  abstract getExpenses(userId: string): Promise<ActivityExpense[]>;
  abstract saveActivity(userId: string, activity: Activity): Promise<Activity>;
  abstract saveExpense(userId: string, expense: ActivityExpense): Promise<ActivityExpense>;
  abstract updateActivity(userId: string, id: string, updates: Partial<Activity>): Promise<void>;
  abstract updateExpense(
    userId: string,
    id: string,
    updates: Partial<ActivityExpense>,
  ): Promise<void>;
  abstract deleteActivity(userId: string, id: string): Promise<void>;
  abstract deleteExpense(userId: string, id: string): Promise<void>;
  abstract syncActivitiesForField(userId: string, fieldId: string): Promise<Activity[]>;
  abstract syncExpensesForActivity(userId: string, activityId: string): Promise<ActivityExpense[]>;
}
