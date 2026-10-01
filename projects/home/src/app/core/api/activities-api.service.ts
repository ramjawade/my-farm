import { Injectable } from '@angular/core';
import { HttpService } from '../http/http.service';
import {
  Activity,
  ActivityExpense,
  NewActivity,
  NewActivityExpense,
} from '../../features/activity/activity.models';
import { ActivityMapperService } from './activity-mapper.service';

/** Rows per request when filling the shared cache (the API's maximum page size). */
const CACHE_PAGE_SIZE = 100;
/** Runaway guard: 200 pages is 20,000 rows, far beyond any real farm. */
const MAX_PAGES = 200;

interface PagedResponse<T> {
  items: T[];
  cursor?: string | null;
  has_more?: boolean;
}

/**
 * Activities & their nested expenses, backed by the MyFarm backend via
 * Firebase-authenticated HTTP requests. Online-only — no offline outbox.
 *
 * Mapping between the Angular model and the backend schema delegates to
 * `ActivityMapperService` (`providedIn: 'root'`, shared with the targeted-
 * fetch services) so the wire mapping lives in one place.
 */
@Injectable({ providedIn: 'root' })
export class ActivitiesApiService {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private httpService: HttpService,
    private activityMapper: ActivityMapperService,
  ) {}

  private enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.writeQueue.then(() => fn());
    this.writeQueue = promise.catch(() => {
      // Continue the queue even if this write fails
    });
    return promise;
  }

  private async fetchList<T>(path: string): Promise<T[]> {
    const resp = await this.httpService.get<{ items: T[] }>(path);
    return resp.items;
  }

  /**
   * Fills a list by following the API cursor in pages of up to `CACHE_PAGE_SIZE`, so no single
   * response is huge. A response without `has_more` is a complete list (an API that predates
   * pagination).
   */
  private async fetchAllPages<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params: Record<string, string> = { limit: String(CACHE_PAGE_SIZE) };
      if (cursor) params['cursor'] = cursor;
      const resp: PagedResponse<T> = await this.httpService.get<PagedResponse<T>>(path, params);

      if (resp.has_more === undefined && resp.items.length >= CACHE_PAGE_SIZE) {
        // A pre-pagination API treats `limit` as a cap and silently truncates; ask for everything.
        return this.fetchList<T>(path);
      }
      items.push(...resp.items);
      if (!resp.has_more || !resp.cursor) return items;
      cursor = resp.cursor;
    }
    console.error(`Stopped paging ${path} after ${MAX_PAGES} pages`);
    return items;
  }

  async getActivities(userId: number): Promise<Activity[]> {
    try {
      const items = await this.fetchAllPages<unknown>('/activities');
      return items.map((item) => this.activityMapper.fromBackend(item));
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  async saveActivity(userId: number, activity: NewActivity): Promise<Activity> {
    return this.enqueueWrite(async () => {
      const payload = this.activityMapper.toBackend(activity);
      try {
        const response = await this.httpService.post<unknown>('/activities', payload);
        return this.activityMapper.fromBackend(response);
      } catch (error) {
        console.error('Failed to save activity:', error);
        throw error;
      }
    });
  }

  async updateActivity(userId: number, id: number, updates: Partial<Activity>): Promise<void> {
    return this.enqueueWrite(async () => {
      const payload = this.activityMapper.toBackend(updates);
      try {
        await this.httpService.patch(`/activities/${id}`, payload);
      } catch (error) {
        console.error('Failed to update activity:', error);
        throw error;
      }
    });
  }

  async deleteActivity(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      try {
        await this.httpService.delete(`/activities/${id}`);
      } catch (error) {
        console.error('Failed to delete activity:', error);
        throw error;
      }
    });
  }

  async syncActivitiesForField(userId: number, fieldId: number): Promise<Activity[]> {
    try {
      const activities = await this.getActivities(userId);
      return activities.filter((a) => a.fieldId === fieldId);
    } catch (error) {
      console.error('Failed to sync activities for field:', error);
      return [];
    }
  }

  async syncExpensesForActivity(userId: number, activityId: number): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchList<unknown>(`/activities/${activityId}/expenses`);
      return items.map((item) => this.activityMapper.expenseFromBackend(item));
    } catch (error) {
      console.error('Failed to sync expenses for activity:', error);
      return [];
    }
  }

  async getExpenses(userId: number): Promise<ActivityExpense[]> {
    try {
      const items = await this.fetchAllPages<unknown>('/activities/expenses');
      return items.map((item) => this.activityMapper.expenseFromBackend(item));
    } catch (error) {
      console.error('Failed to get expenses:', error);
      return [];
    }
  }

  async saveExpense(userId: number, expense: NewActivityExpense): Promise<ActivityExpense> {
    return this.enqueueWrite(async () => {
      const payload = this.activityMapper.expenseToBackend(expense);
      try {
        const response = await this.httpService.post<unknown>(
          `/activities/${expense.activityId}/expenses`,
          payload,
        );
        return this.activityMapper.expenseFromBackend(response);
      } catch (error) {
        console.error('Failed to save expense:', error);
        throw error;
      }
    });
  }

  async updateExpense(
    userId: number,
    id: number,
    updates: Partial<ActivityExpense>,
  ): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = updates.activityId ?? (await this.findExpenseActivityId(id));
      if (!activityId) {
        throw new Error(`updateExpense: could not resolve the owning activity for expense ${id}`);
      }
      const payload = this.activityMapper.expenseToBackend(updates);
      try {
        await this.httpService.patch(`/activities/${activityId}/expenses/${id}`, payload);
      } catch (error) {
        console.error('Failed to update expense:', error);
        throw error;
      }
    });
  }

  async deleteExpense(userId: number, id: number): Promise<void> {
    return this.enqueueWrite(async () => {
      const activityId = await this.findExpenseActivityId(id);
      if (!activityId) {
        console.warn(`deleteExpense: could not find the activity owning expense ${id}`);
        return;
      }
      try {
        await this.httpService.delete(`/activities/${activityId}/expenses/${id}`);
      } catch (error) {
        console.error('Failed to delete expense:', error);
        throw error;
      }
    });
  }

  private async findExpenseActivityId(expenseId: number): Promise<number | null> {
    try {
      const expenses = await this.getExpenses(0);
      const expense = expenses.find((e) => e.id === expenseId);
      return expense?.activityId ?? null;
    } catch {
      return null;
    }
  }
}
