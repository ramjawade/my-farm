import { Injectable, inject } from '@angular/core';

import { ActivityService } from '../../features/activity/activity.service';
import {
  Activity,
  ActivityStatus,
  ActivityType,
  NewActivity,
} from '../../features/activity/activity.models';
import { HttpService } from '../http/http.service';

/** One expense line from `POST /api/v1/activities/parse`. */
export interface ParsedExpenseLine {
  expense_category_id: number | null;
  category: string | null;
  quantity: string | null;
  unit: string | null;
  rate: string | null;
  amount: string | null;
  remarks: string | null;
}

/** A field the backend refused to use, and why (#242). */
export interface DroppedField {
  field: string;
  value: string;
  reason: 'not_found' | 'ambiguous';
}

/** An entry with names resolved to ids by the backend (#242). */
export interface ResolvedEntry {
  transcript: string;
  activity_type_id: number;
  activity_type: string;
  date: string | null;
  crop_id: number | null;
  crop: string | null;
  land_id: number | null;
  land: string | null;
  notes: string | null;
  expenses: ParsedExpenseLine[];
  dropped: DroppedField[];
}

export interface ChatParseResponse {
  parsed: ResolvedEntry;
  model: string;
}

/** Why a parse attempt failed, in terms the UI can act on. */
export type ChatEntryFailure = 'not-understood' | 'unavailable';

export class ChatEntryError extends Error {
  constructor(readonly kind: ChatEntryFailure) {
    super(kind);
  }
}

/**
 * Natural-language entry creation (#243).
 *
 * Owns the two-step flow — parse, then create — so the component stays
 * presentation-only. Persistence goes through `ActivityService`, which is
 * backed by `IStorageService`: this service never writes directly, so chat
 * entry has exactly the same persistence path as the manual form.
 */
@Injectable({ providedIn: 'root' })
export class ChatEntryService {
  private readonly http = inject(HttpService);
  private readonly activities = inject(ActivityService);

  /**
   * Parse plain-language text. Persists nothing.
   *
   * Maps the backend's status codes onto the two things the UI does
   * differently: 422 means ask the farmer to rephrase, anything else means
   * the feature is unavailable and the manual form is the way through.
   */
  async parse(text: string): Promise<ChatParseResponse> {
    try {
      return await this.http.post<ChatParseResponse>('/activities/parse', { text });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      throw new ChatEntryError(status === 422 ? 'not-understood' : 'unavailable');
    }
  }

  /**
   * Create the activity and its expenses from a resolved entry.
   *
   * Ids the backend resolved are used as-is; only the names it also returned
   * are mapped onto the Angular model's union types. Nothing is re-resolved
   * on the client — that decision was made server-side, where the crop and
   * land checks are a real tenant boundary.
   */
  async create(entry: ResolvedEntry): Promise<Activity> {
    const draft: NewActivity = {
      type: entry.activity_type as ActivityType,
      // The farmer is recording something already done, not scheduling it.
      status: 'Completed' as ActivityStatus,
      date: entry.date ? new Date(entry.date).getTime() : Date.now(),
      cropId: entry.crop_id ?? undefined,
      fieldId: entry.land_id ?? undefined,
      notes: entry.notes ?? undefined,
    };

    const activity = await this.activities.addActivity(draft);

    for (const line of entry.expenses) {
      // A line with no amount carries nothing worth storing.
      const amount = toNumber(line.amount);
      if (amount === undefined) continue;
      await this.activities.addExpense({
        activityId: activity.id,
        category: line.category ?? 'Other',
        quantity: toNumber(line.quantity),
        unit: line.unit ?? undefined,
        rate: toNumber(line.rate),
        amount,
        remarks: line.remarks ?? undefined,
      });
    }

    return activity;
  }

  /**
   * Reverse a creation.
   *
   * Deleting the activity removes its expenses with it — the backend cascades
   * (`ActivityExpense` is owned by `Activity`), so there is no partial state
   * left behind for the farmer to clean up.
   */
  undo(activityId: number): void {
    this.activities.deleteActivity(activityId);
  }
}

/** Decimal strings arrive from the API as strings; blank means absent. */
function toNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
