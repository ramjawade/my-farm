import { Injectable, signal, inject, effect, computed } from '@angular/core';
import {
  CropEntity,
  CropActivity,
  CropActivityInput,
  CropStage,
  CROP_STAGES,
  ActivityType,
  NewCrop,
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
      .filter((a): a is Activity & { cropId: number } => !!a.cropId)
      .map((a) => ({
        ...a,
        cost: costs[a.id] || 0,
        notes: a.notes || '',
        attachments: a.attachments || [],
        metadata: a.metadata || {},
      }));
  });

  /** Last completed activity date per crop. Used to detect stale crops. */
  readonly lastActivityDateByCrop = computed<Record<number, number | null>>(() => {
    const result: Record<number, number | null> = {};
    const acts = this.activityService.activities();
    for (const crop of this.cropsSignal()) {
      const cropActs = acts
        .filter((a) => a.cropId === crop.id && a.status === 'Completed')
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      result[crop.id] = cropActs.length > 0 && cropActs[0].date ? cropActs[0].date : null;
    }
    return result;
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

  private currentUserId(): number {
    return this.authService.currentUser()?.id ?? 0;
  }

  // --- Crop API ---
  getCropById(id: number): CropEntity | undefined {
    return this.cropsSignal().find((c) => c.id === id);
  }

  cropsForField(fieldId: number): CropEntity[] {
    return this.cropsSignal().filter((c) => c.fieldId === fieldId);
  }

  /** Total expenses across every activity linked to the crop. */
  costForCrop(cropId: number): number {
    return this.activities()
      .filter((a) => a.cropId === cropId)
      .reduce((sum, a) => sum + a.cost, 0);
  }

  /** Saves the crop, then creates its stage activities linked to the crop's server-minted id. */
  async addCrop(cropData: NewCrop): Promise<CropEntity> {
    this.generation++;
    const saved = await this.storage.saveCrop(this.currentUserId(), {
      ...cropData,
      season:
        cropData.season ?? (cropData.sowingDate ? seasonForDate(cropData.sowingDate) : undefined),
    });
    this.cropsSignal.update((crops) => [saved, ...crops.filter((c) => c.id !== saved.id)]);

    // One activity per lifecycle stage: past stages completed, later ones scheduled.
    // Sequential so each stage's lookups (findMainActivityForStage) see the earlier ones.
    const hasSowingDate = saved.sowingDate !== undefined && saved.sowingDate !== null;
    const sowingTime = hasSowingDate ? Number(saved.sowingDate) : 0;
    const currentStageIdx = CROP_STAGES.indexOf(saved.currentStage);

    for (const [idx, stage] of CROP_STAGES.entries()) {
      await this.addActivity({
        cropId: saved.id,
        type: stageActivityType(stage),
        date: hasSowingDate ? sowingTime + STAGE_OFFSET_DAYS[stage] * ONE_DAY : undefined,
        status: idx <= currentStageIdx ? 'Completed' : 'Scheduled',
        cost: 0,
        notes: stageNote(stage),
      });
    }

    return saved;
  }

  updateCrop(id: number, updates: Partial<CropEntity>): void {
    this.generation++;
    this.cropsSignal.set(this.cropsSignal().map((c) => (c.id === id ? { ...c, ...updates } : c)));
    this.persistCropUpdate(id, updates);
  }

  /** Get the next growth stage after the provided stage, or null if already at Harvest. */
  getNextStage(currentStage: CropStage): CropStage | null {
    const currentIdx = CROP_STAGES.indexOf(currentStage);
    if (currentIdx < 0 || currentIdx >= CROP_STAGES.length - 1) return null;
    return CROP_STAGES[currentIdx + 1];
  }

  deleteCrop(id: number): void {
    this.generation++;
    this.cropsSignal.set(this.cropsSignal().filter((c) => c.id !== id));
    this.persistCropDelete(id);
    this.activityService.deleteActivitiesForCrop(id);
  }

  // --- Activity API (delegates to ActivityService) ---
  async addActivity(input: CropActivityInput): Promise<CropActivity> {
    const crop = this.getCropById(input.cropId);
    const created = await this.activityService.addActivity({
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
      await this.activityService.addExpense({
        activityId: created.id,
        category: defaultExpenseCategory(input.type),
        amount: input.cost,
        remarks: 'Logged from crop timeline',
      });
    }

    this.syncStageFromActivity(created.id);
    this.updateCropUpcomingActivity(input.cropId);
    return this.getCropActivity(created.id)!;
  }

  /** Sync crop stage based on completed activities. */
  syncStageFromActivity(activityId: number): void {
    const activity = this.activityService.getActivityById(activityId);
    if (!activity?.cropId || activity.status !== 'Completed') return;

    // Case 1: sub-activity under a stage — complete the parent stage
    if (activity.parentActivityId) {
      const parent = this.activityService.getActivityById(activity.parentActivityId);
      if (parent && parent.status !== 'Completed') {
        this.activityService.updateActivity(parent.id, {
          status: 'Completed',
          date: activity.date ?? Date.now(),
        });
        const stage = this.stageFromNote(parent.notes);
        if (stage) {
          this.reachStage(activity.cropId, stage);
        }
      }
      return;
    }

    // Case 2: a stage activity (from notes) reached
    const stage = this.stageFromNote(activity.notes);
    if (stage) {
      this.reachStage(activity.cropId, stage);
      return;
    }

    // Case 3: Harvest activity completed
    if (activity.type === 'Harvest') {
      this.reachStage(activity.cropId, 'Harvest');
    }
  }

  /** Advance crop to a stage only if it's ahead of the current stage. */
  private reachStage(cropId: number, stage: CropStage): void {
    const crop = this.getCropById(cropId);
    if (!crop) return;

    const currentIdx = CROP_STAGES.indexOf(crop.currentStage);
    const targetIdx = CROP_STAGES.indexOf(stage);
    if (targetIdx <= currentIdx) return; // Only move forward

    this.updateCrop(cropId, { currentStage: stage });

    // Make sure the next stage has a scheduled activity
    const nextStage = this.getNextStage(stage);
    if (nextStage) {
      this.ensureScheduledActivityForStage(cropId, nextStage).catch((e) =>
        console.error('Failed to schedule next stage activity', e),
      );
    }
  }

  /** Shorthand: update activity to Completed and sync stage. */
  completeActivity(id: number): void {
    const existing = this.activityService.getActivityById(id);
    if (!existing) return;
    this.updateActivity(id, {
      status: 'Completed',
      date: Date.now(),
    });
    if (existing.cropId) {
      this.syncStageFromActivity(id);
    }
  }

  /** Manually advance to the next stage. */
  advanceStage(cropId: number): void {
    const crop = this.getCropById(cropId);
    if (!crop) return;
    const nextStage = this.getNextStage(crop.currentStage);
    if (nextStage) {
      this.reachStage(cropId, nextStage);
    }
  }

  updateActivity(id: number, updates: Partial<CropActivityInput>): void {
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

  deleteActivity(id: number): void {
    const existing = this.activityService.getActivityById(id);
    if (!existing) return;
    this.activityService.deleteActivity(id);
    if (existing.cropId) this.updateCropUpcomingActivity(existing.cropId);
  }

  getActivitiesForCrop(cropId: number): CropActivity[] {
    return this.activities().filter((a) => a.cropId === cropId);
  }

  getCropActivity(id: number): CropActivity | undefined {
    return this.activities().find((a) => a.id === id);
  }

  findMainActivityForStage(cropId: number, stage: CropStage): CropActivity | undefined {
    return this.getActivitiesForCrop(cropId).find(
      (a) =>
        !a.parentActivityId &&
        ((a.type === 'Field Inspection' && a.notes.includes(`advanced to: ${stage}`)) ||
          (stage === 'Sowing' && a.type === 'Sowing') ||
          (stage === 'Harvest' && a.type === 'Harvest')),
    );
  }

  /** Ensure a Scheduled placeholder activity exists for a stage, without completing an existing one. */
  async ensureScheduledActivityForStage(cropId: number, stage: CropStage): Promise<CropActivity> {
    const existing = this.findMainActivityForStage(cropId, stage);
    if (existing) return existing;
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
  private syncCost(activityId: number, type: ActivityType, cost: number): void {
    const expenses = this.activityService.getExpensesForActivity(activityId);
    if (cost > 0) {
      if (expenses.length > 0) {
        this.activityService.updateExpense(expenses[0].id, { amount: cost });
      } else {
        this.activityService
          .addExpense({
            activityId,
            category: defaultExpenseCategory(type),
            amount: cost,
            remarks: 'Logged from crop timeline',
          })
          .catch((e) => console.error('Failed to save expense', e));
      }
    } else {
      expenses.forEach((e) => this.activityService.deleteExpense(e.id));
    }
  }

  private updateCropUpcomingActivity(cropId: number): void {
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

  private async loadForUser(userId: number): Promise<void> {
    const generation = ++this.generation;
    try {
      let crops = await this.storage.getCrops(userId);
      if (generation !== this.generation) return; // a mutation or newer load won

      // Backward compatibility: scan existing crops for auto-advancement eligibility
      crops = this.migrateAutoAdvancedCrops(crops);

      this.cropsSignal.set(crops);
    } catch (e) {
      console.error('Failed to load crops from storage', e);
      this.cropsSignal.set([]);
    }
  }

  /** Backward compatibility: migrate crops by catching up to the furthest completed stage. */
  private migrateAutoAdvancedCrops(crops: CropEntity[]): CropEntity[] {
    return crops.map((crop) => {
      // Find the latest completed stage activity
      const completedStages = this.getActivitiesForCrop(crop.id)
        .filter(
          (a) =>
            !a.parentActivityId &&
            a.status === 'Completed' &&
            a.notes.includes('Growth stage advanced to'),
        )
        .map((a) => this.stageFromNote(a.notes))
        .filter((stage): stage is CropStage => !!stage);

      if (completedStages.length === 0) return crop;

      const latestCompletedStage = completedStages.reduce((furthest, stage) =>
        CROP_STAGES.indexOf(stage) > CROP_STAGES.indexOf(furthest) ? stage : furthest,
      );

      // Catch up to the latest completed stage, but never beyond it
      if (CROP_STAGES.indexOf(crop.currentStage) < CROP_STAGES.indexOf(latestCompletedStage)) {
        return { ...crop, currentStage: latestCompletedStage };
      }

      return crop;
    });
  }

  private persistCropUpdate(id: number, updates: Partial<CropEntity>): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage.updateCrop(user.id, id, updates).catch((e) => {
        console.error('Failed to update crop', e);
        this.reload();
      });
    }
  }

  private persistCropDelete(id: number): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage.deleteCrop(user.id, id).catch((e) => {
        console.error('Failed to delete crop', e);
        this.reload();
      });
    }
  }
}
