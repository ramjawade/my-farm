import { Injectable, signal, inject, effect, computed } from '@angular/core';
import {
  CropEntity,
  CropActivity,
  CropActivityInput,
  CropStage,
  CROP_STAGES,
  ActivityType,
} from './crop-timeline.models';
import { AuthService } from '../../core/auth/auth.service';
import { ActivityService } from '../activity/activity.service';
import { Activity } from '../activity/activity.models';
import { seasonForDate } from '../../core/models/season';
import { IStorageService } from '../../core/storage/storage.interface';

const STAGE_NOTE_PREFIX = 'Growth stage advanced to: ';
const ONE_DAY = 24 * 60 * 60 * 1000;

/** Days after sowing at which each growth stage is expected. */
const STAGE_OFFSET_DAYS: Record<CropStage, number> = {
  'Land Preparation': -5,
  Sowing: 0,
  Germination: 7,
  'Vegetative Growth': 21,
  Flowering: 45,
  'Fruiting / Pod Formation': 60,
  Maturity: 90,
  Harvest: 100,
};

function stageActivityType(stage: CropStage): ActivityType {
  return stage === 'Sowing' ? 'Sowing' : stage === 'Harvest' ? 'Harvest' : 'Field Inspection';
}

function stageNote(stage: CropStage): string {
  return `${STAGE_NOTE_PREFIX}${stage}.`;
}

/** Map an expense category from the activity type when the timeline logs a lump-sum cost. */
function defaultExpenseCategory(type: ActivityType): string {
  switch (type) {
    case 'Sowing':
      return 'Seeds';
    case 'Fertilizer Application':
      return 'Fertilizer';
    case 'Spray Application':
      return 'Pesticide';
    case 'Labour Activity':
    case 'Weeding':
      return 'Labour';
    case 'Irrigation':
      return 'Water';
    default:
      return 'Other';
  }
}

/**
 * Crop lifecycle state. Crops are owned here; activities are owned by
 * `ActivityService` and exposed through `activities` as a crop-scoped view
 * (`CropActivity`) so every screen reads the same records.
 */
@Injectable({
  providedIn: 'root',
})
export class CropTimelineService {
  private readonly authService = inject(AuthService);
  private readonly activityService = inject(ActivityService);
  private readonly storage = inject(IStorageService);
  private readonly cropsSignal = signal<CropEntity[]>([]);

  // Bumped on every load and mutation so a load that resolves late is discarded.
  private generation = 0;

  readonly crops = this.cropsSignal.asReadonly();

  /** Every unified activity linked to a crop, with its expense total. */
  readonly activities = computed<CropActivity[]>(() => {
    const costs = this.activityService.costByActivity();
    return this.activityService
      .activities()
      .filter((a): a is Activity & { cropId: string } => !!a.cropId)
      .map((a) => ({
        ...a,
        cost: costs[a.id] || 0,
        notes: a.notes || '',
        attachments: a.attachments || [],
        metadata: a.metadata || {},
      }));
  });

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadForUser(user.id);
      } else {
        this.cropsSignal.set([]);
      }
    });
  }

  // --- Crop API ---
  getCropById(id: string): CropEntity | undefined {
    return this.cropsSignal().find((c) => c.id === id);
  }

  cropsForField(fieldId: string): CropEntity[] {
    return this.cropsSignal().filter((c) => c.fieldId === fieldId);
  }

  /** Total expenses across every activity linked to the crop. */
  costForCrop(cropId: string): number {
    return this.activities()
      .filter((a) => a.cropId === cropId)
      .reduce((sum, a) => sum + a.cost, 0);
  }

  addCrop(cropData: Omit<CropEntity, 'id'>): CropEntity {
    const newCrop: CropEntity = {
      ...cropData,
      season:
        cropData.season ?? (cropData.sowingDate ? seasonForDate(cropData.sowingDate) : undefined),
      id: 'c-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
    };

    this.setCrops([newCrop, ...this.cropsSignal()]);

    // One activity per lifecycle stage: past stages completed, later ones scheduled.
    const hasSowingDate = newCrop.sowingDate !== undefined && newCrop.sowingDate !== null;
    const sowingTime = hasSowingDate ? Number(newCrop.sowingDate) : 0;
    const currentStageIdx = CROP_STAGES.indexOf(newCrop.currentStage);

    CROP_STAGES.forEach((stage, idx) => {
      const reached = idx <= currentStageIdx;
      this.addActivity({
        cropId: newCrop.id,
        type: stageActivityType(stage),
        date: hasSowingDate ? sowingTime + STAGE_OFFSET_DAYS[stage] * ONE_DAY : undefined,
        status: reached ? 'Completed' : 'Scheduled',
        cost: 0,
        notes: stageNote(stage),
      });
    });

    return newCrop;
  }

  updateCrop(id: string, updates: Partial<CropEntity>): void {
    this.setCrops(this.cropsSignal().map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  deleteCrop(id: string): void {
    this.setCrops(this.cropsSignal().filter((c) => c.id !== id));
    this.activityService.deleteActivitiesForCrop(id);
  }

  // --- Activity API (delegates to ActivityService) ---
  addActivity(input: CropActivityInput): CropActivity {
    const crop = this.getCropById(input.cropId);
    const created = this.activityService.addActivity({
      id: input.id,
      parentActivityId: input.parentActivityId,
      cropId: input.cropId,
      fieldId: crop?.fieldId,
      type: input.type,
      date: input.date,
      season: crop?.season ?? seasonForDate(input.date ?? Date.now()),
      status: input.status,
      notes: input.notes,
      attachments: input.attachments ?? [],
      metadata: input.metadata ?? {},
    });

    if (input.cost > 0) {
      this.activityService.addExpense({
        activityId: created.id,
        category: defaultExpenseCategory(input.type),
        amount: input.cost,
        remarks: 'Logged from crop timeline',
      });
    }

    // Logging work under a scheduled stage marks the stage reached.
    if (input.parentActivityId) {
      const parent = this.activityService.getActivityById(input.parentActivityId);
      if (parent && parent.status !== 'Completed' && parent.status !== 'Cancelled') {
        this.activityService.updateActivity(parent.id, {
          status: 'Completed',
          date: input.date ?? Date.now(),
        });
        const stage = this.stageFromNote(parent.notes);
        if (stage) this.updateCrop(input.cropId, { currentStage: stage });
      }
    }

    this.updateCropUpcomingActivity(input.cropId);
    return this.getCropActivity(created.id)!;
  }

  updateActivity(id: string, updates: Partial<CropActivityInput>): void {
    const existing = this.activityService.getActivityById(id);
    if (!existing) return;

    const { cost, metadata, ...rest } = updates;
    const patch: Partial<Activity> = { ...rest };
    if (metadata) patch.metadata = { ...(existing.metadata || {}), ...metadata };
    if (rest.cropId) patch.fieldId = this.getCropById(rest.cropId)?.fieldId;
    this.activityService.updateActivity(id, patch);

    if (cost !== undefined) this.syncCost(id, updates.type ?? existing.type, cost);

    const cropId = rest.cropId ?? existing.cropId;
    if (cropId) this.updateCropUpcomingActivity(cropId);
  }

  deleteActivity(id: string): void {
    const existing = this.activityService.getActivityById(id);
    if (!existing) return;
    this.activityService.deleteActivity(id);
    if (existing.cropId) this.updateCropUpcomingActivity(existing.cropId);
  }

  getActivitiesForCrop(cropId: string): CropActivity[] {
    return this.activities().filter((a) => a.cropId === cropId);
  }

  getCropActivity(id: string): CropActivity | undefined {
    return this.activities().find((a) => a.id === id);
  }

  findMainActivityForStage(cropId: string, stage: CropStage): CropActivity | undefined {
    return this.getActivitiesForCrop(cropId).find(
      (a) =>
        !a.parentActivityId &&
        ((a.type === 'Field Inspection' && a.notes.includes(`advanced to: ${stage}`)) ||
          (stage === 'Sowing' && a.type === 'Sowing') ||
          (stage === 'Harvest' && a.type === 'Harvest')),
    );
  }

  findOrCreateMainActivityForStage(cropId: string, stage: CropStage): CropActivity {
    const existing = this.findMainActivityForStage(cropId, stage);
    if (existing) {
      if (existing.status !== 'Completed') {
        this.updateActivity(existing.id, { status: 'Completed', date: Date.now() });
        return this.getCropActivity(existing.id)!;
      }
      return existing;
    }
    return this.addActivity({
      cropId,
      type: stageActivityType(stage),
      status: 'Scheduled',
      cost: 0,
      notes: stageNote(stage),
    });
  }

  // --- Helpers ---
  private stageFromNote(notes: string | undefined): CropStage | undefined {
    if (!notes) return undefined;
    const match = notes.match(/Growth stage advanced to:\s*(.+)\./);
    const stage = match?.[1]?.trim() as CropStage | undefined;
    return stage && CROP_STAGES.includes(stage) ? stage : undefined;
  }

  /** Keep a single lump-sum expense line in sync with the timeline's `cost` field. */
  private syncCost(activityId: string, type: ActivityType, cost: number): void {
    const expenses = this.activityService.getExpensesForActivity(activityId);
    if (cost > 0) {
      if (expenses.length > 0) {
        this.activityService.updateExpense(expenses[0].id, { amount: cost });
      } else {
        this.activityService.addExpense({
          activityId,
          category: defaultExpenseCategory(type),
          amount: cost,
          remarks: 'Logged from crop timeline',
        });
      }
    } else {
      expenses.forEach((e) => this.activityService.deleteExpense(e.id));
    }
  }

  private updateCropUpcomingActivity(cropId: string): void {
    if (!this.getCropById(cropId)) return;
    const planned = this.getActivitiesForCrop(cropId)
      .filter((a) => !a.parentActivityId && (a.status === 'Scheduled' || a.status === 'Draft'))
      .sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity));

    if (planned.length === 0) {
      this.updateCrop(cropId, { upcomingActivity: undefined });
      return;
    }

    const next = planned[0];
    if (!next.date) {
      this.updateCrop(cropId, { upcomingActivity: next.type });
      return;
    }
    const days = Math.ceil((next.date - Date.now()) / ONE_DAY);
    const relative = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} Days`;
    this.updateCrop(cropId, { upcomingActivity: `${next.type} (${relative})` });
  }

  // --- Storage ---
  /** Re-read the signed-in user's crops from storage. */
  reload(): Promise<void> {
    const user = this.authService.currentUser();
    return user ? this.loadForUser(user.id) : Promise.resolve();
  }

  private async loadForUser(userId: string): Promise<void> {
    const generation = ++this.generation;
    try {
      const crops = await this.storage.getCrops(userId);
      if (generation !== this.generation) return; // a mutation or newer load won
      this.cropsSignal.set(crops);
    } catch (e) {
      console.error('Failed to load crops from storage', e);
      this.cropsSignal.set([]);
    }
  }

  /** Apply a crop mutation and persist it for the signed-in user. */
  private setCrops(crops: CropEntity[]): void {
    this.generation++;
    this.cropsSignal.set(crops);
    const user = this.authService.currentUser();
    if (user) {
      this.storage.saveCrops(user.id, crops).catch((e) => console.error('Failed to save crops', e));
    }
  }
}
