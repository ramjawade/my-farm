import { Injectable, signal, computed, inject, effect } from '@angular/core';
import {
  Activity,
  ActivityExpense,
  ActivityKpiSummary,
  NewActivity,
  NewActivityExpense,
} from './activity.models';
import { IStorageService } from '../../core/storage/storage.interface';
import { AuthService } from '../../core/auth/auth.service';
import { HttpService } from '../../core/http/http.service';
import { ActivityMapperService } from '../../core/api/activity-mapper.service';

@Injectable({
  providedIn: 'root',
})
export class ActivityService {
  private readonly storage = inject(IStorageService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpService);
  private readonly activityMapper = inject(ActivityMapperService);

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
    // Skip entirely while logged out — an anonymous fetch just hits 401/404
    // and floods the console on every boot.
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.loadFromStorage();
      } else {
        this.activitiesSignal.set([]);
        this.expensesSignal.set([]);
      }
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

  // --- Dashboard: targeted queries against /api/v1/activities ---
  // These call the backend directly (not the activities/expenses signal
  // cache above) so the dashboard can ask for exactly what it needs
  // instead of loading and filtering the full list client-side.

  /** KPI counts + total expense, optionally scoped to a crop. */
  async getKpiSummary(cropId?: number): Promise<ActivityKpiSummary> {
    const query = cropId !== undefined ? `?crop_id=${cropId}` : '';
    const resp = await this.http.get<{
      total: number;
      completed: number;
      in_progress: number;
      total_expense: number;
    }>(`/activities/summary${query}`);
    return {
      total: resp.total,
      completed: resp.completed,
      inProgress: resp.in_progress,
      totalExpense: resp.total_expense,
    };
  }

  /** Top `limit` not-yet-completed activities, soonest first, optionally scoped to a crop. */
  async getUpcomingActivities(cropId?: number, limit = 5): Promise<Activity[]> {
    return this.queryActivities({
      status: ['Scheduled', 'Draft', 'In Progress'],
      sort: 'date_asc',
      limit,
      cropId,
    });
  }

  /** Top `limit` completed activities, most recent first, optionally scoped to a crop. */
  async getRecentActivities(cropId?: number, limit = 5): Promise<Activity[]> {
    return this.queryActivities({
      status: ['Completed'],
      sort: 'date_desc',
      limit,
      cropId,
    });
  }

  /**
   * Targeted `/api/v1/activities` query — every option is optional, so an
   * empty call hits plain `GET /activities` (backend's unfiltered `list_all`
   * path). Used by the dashboard's KPI/upcoming/recent methods above and by
   * `ActivityListService` for the full activity-list view.
   */
  async queryActivities(opts: {
    status?: string[];
    sort?: 'date_asc' | 'date_desc';
    limit?: number;
    cropId?: number;
  }): Promise<Activity[]> {
    const params: string[] = (opts.status ?? []).map((s) => `status=${encodeURIComponent(s)}`);
    if (opts.sort) params.push(`sort=${opts.sort}`);
    if (opts.limit !== undefined) params.push(`limit=${opts.limit}`);
    if (opts.cropId !== undefined) params.push(`crop_id=${opts.cropId}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const response = await this.http.get<{ items: unknown[] }>(`/activities${query}`);
    return Promise.all(response.items.map((item) => this.activityMapper.fromBackend(item)));
  }
}
