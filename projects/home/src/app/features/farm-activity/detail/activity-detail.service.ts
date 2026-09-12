import { Injectable, inject } from '@angular/core';
import { HttpService } from '../../../core/http/http.service';
import { ActivityMapperService } from './activity-mapper.service';
import { Activity, ActivityDetailSummary, ActivityHistoryEntry, ActivityStatus } from '../../activity/activity.models';

/**
 * Targeted fetches for a single activity's own record — the KPI summary,
 * the history/audit trail, and status/delete actions. Expense reads/writes
 * live in `ActivityExpensesService` instead (SRP split per #181).
 */
@Injectable({ providedIn: 'root' })
export class ActivityDetailService {
  private readonly http = inject(HttpService);
  private readonly mapper = inject(ActivityMapperService);

  async getActivity(id: number): Promise<Activity> {
    const item = await this.http.get<unknown>(`/activities/${id}`);
    return this.mapper.fromBackend(item);
  }

  async getSummary(id: number): Promise<ActivityDetailSummary> {
    const item = await this.http.get<{
      total_expense: number;
      expense_count: number;
      days_since_created: number;
      status: ActivityStatus;
    }>(`/activities/${id}/summary`);
    return {
      totalExpense: Number(item.total_expense ?? 0),
      expenseCount: item.expense_count ?? 0,
      daysSinceCreated: item.days_since_created ?? 0,
      status: item.status,
    };
  }

  async getHistory(id: number): Promise<ActivityHistoryEntry[]> {
    const resp = await this.http.get<{ items: any[] }>(`/activities/${id}/history`);
    return resp.items.map((item) => ({
      id: item.id,
      activityId: item.activity_id,
      eventType: item.event_type,
      detail: item.detail ?? undefined,
      createdAt: new Date(item.created_at).getTime(),
    }));
  }

  async updateStatus(id: number, status: ActivityStatus): Promise<Activity> {
    const item = await this.http.patch<unknown>(`/activities/${id}`, { status });
    return this.mapper.fromBackend(item);
  }

  async deleteActivity(id: number): Promise<void> {
    await this.http.delete(`/activities/${id}`);
  }
}
