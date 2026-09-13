import { Injectable, inject } from '@angular/core';
import { HttpService } from '../../../core/http/http.service';
import { ActivityMapperService } from '../../../core/api/activity-mapper.service';
import { ActivityExpense, NewActivityExpense } from '../../activity/activity.models';

/**
 * Targeted fetches for a single activity's expenses — list/add/update/delete.
 * Activity-record concerns (status, delete, KPIs, history) live in
 * `ActivityDetailService` instead (SRP split per #181).
 */
@Injectable({ providedIn: 'root' })
export class ActivityExpensesService {
  private readonly http = inject(HttpService);
  private readonly mapper = inject(ActivityMapperService);

  async getExpenses(activityId: number): Promise<ActivityExpense[]> {
    const resp = await this.http.get<{ items: unknown[] }>(`/activities/${activityId}/expenses`);
    return Promise.all(resp.items.map((item) => this.mapper.expenseFromBackend(item)));
  }

  async addExpense(
    activityId: number,
    data: Omit<NewActivityExpense, 'activityId'>,
  ): Promise<ActivityExpense> {
    const payload = await this.mapper.expenseToBackend(data);
    const item = await this.http.post<unknown>(`/activities/${activityId}/expenses`, payload);
    return this.mapper.expenseFromBackend(item);
  }

  async updateExpense(
    activityId: number,
    expenseId: number,
    updates: Partial<ActivityExpense>,
  ): Promise<ActivityExpense> {
    const payload = await this.mapper.expenseToBackend(updates);
    const item = await this.http.patch<unknown>(
      `/activities/${activityId}/expenses/${expenseId}`,
      payload,
    );
    return this.mapper.expenseFromBackend(item);
  }

  async deleteExpense(activityId: number, expenseId: number): Promise<void> {
    await this.http.delete(`/activities/${activityId}/expenses/${expenseId}`);
  }
}
