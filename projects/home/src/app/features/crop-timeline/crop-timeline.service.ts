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

const CROPS_STORAGE_KEY = 'my_farm_crops';
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
  private readonly cropsSignal = signal<CropEntity[]>([]);

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

  private getUserCropsKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_crops` : CROPS_STORAGE_KEY;
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

    const updated = [newCrop, ...this.cropsSignal()];
    this.cropsSignal.set(updated);
    this.saveCropsToStorage(updated);

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
    const updated = this.cropsSignal().map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.cropsSignal.set(updated);
    this.saveCropsToStorage(updated);
  }

  deleteCrop(id: string): void {
    const updatedCrops = this.cropsSignal().filter((c) => c.id !== id);
    this.cropsSignal.set(updatedCrops);
    this.saveCropsToStorage(updatedCrops);
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

  // --- Storage & Seeding ---
  private loadForUser(userId: string): void {
    try {
      const storedCrops = localStorage.getItem(`my_farm_${userId}_crops`);
      const crops: CropEntity[] = storedCrops ? JSON.parse(storedCrops) : [];
      this.cropsSignal.set(crops);
      if (userId === 'f-default' && crops.length === 0) {
        this.seedMockData();
      }
    } catch (e) {
      console.error('Failed to load crops from storage', e);
      this.cropsSignal.set([]);
    }
  }

  private saveCropsToStorage(crops: CropEntity[]): void {
    try {
      localStorage.setItem(this.getUserCropsKey(), JSON.stringify(crops));
    } catch (e) {
      console.error('Failed to save crops to local storage', e);
    }
  }

  private seedMockData(): void {
    const now = Date.now();
    const sowingSoybean = now - 65 * ONE_DAY;
    const sowingWheat = now - 15 * ONE_DAY;

    const crops: CropEntity[] = [
      {
        id: 'c-mock-soybean',
        fieldId: 'default-farm-1',
        name: 'Soybeans',
        cropType: 'Soybeans',
        area: 2.0,
        areaUnit: 'hectares',
        season: 'Kharif',
        sowingDate: sowingSoybean,
        currentStage: 'Flowering',
        status: 'Active',
        expectedHarvestDate: now + 45 * ONE_DAY,
      },
      {
        id: 'c-mock-wheat',
        fieldId: 'default-farm-1',
        name: 'Wheat',
        cropType: 'Wheat',
        area: 4.5,
        areaUnit: 'hectares',
        season: 'Rabi',
        sowingDate: sowingWheat,
        currentStage: 'Germination',
        status: 'Active',
      },
    ];
    this.cropsSignal.set(crops);
    this.saveCropsToStorage(crops);

    const seedStages = (cropId: string, sowing: number, current: CropStage): void => {
      const currentIdx = CROP_STAGES.indexOf(current);
      CROP_STAGES.forEach((stage, idx) => {
        const reached = idx <= currentIdx;
        this.addActivity({
          id: `a-${cropId}-stage-${idx}`,
          cropId,
          type: stageActivityType(stage),
          date: reached ? sowing + STAGE_OFFSET_DAYS[stage] * ONE_DAY : undefined,
          status: reached ? 'Completed' : 'Scheduled',
          cost: 0,
          notes: stageNote(stage),
        });
      });
    };
    seedStages('c-mock-soybean', sowingSoybean, 'Flowering');
    seedStages('c-mock-wheat', sowingWheat, 'Germination');

    const work: CropActivityInput[] = [
      {
        id: 'a-soy-1',
        cropId: 'c-mock-soybean',
        type: 'Sowing',
        date: sowingSoybean,
        status: 'Completed',
        cost: 4500,
        notes: 'Soybean sown with a mechanical seed drill under good moisture.',
      },
      {
        id: 'a-soy-1-sub1',
        cropId: 'c-mock-soybean',
        parentActivityId: 'a-soy-1',
        type: 'Labour Activity',
        date: sowingSoybean,
        status: 'Completed',
        cost: 500,
        notes: 'Helpers loading seed and checking drill calibration.',
      },
      {
        id: 'a-soy-2',
        cropId: 'c-mock-soybean',
        type: 'Weeding',
        date: sowingSoybean + 20 * ONE_DAY,
        status: 'Completed',
        cost: 1500,
        notes: 'Manual weeding done. Field clear of broadleaf weeds.',
      },
      {
        id: 'a-soy-3',
        cropId: 'c-mock-soybean',
        type: 'Fertilizer Application',
        date: sowingSoybean + 35 * ONE_DAY,
        status: 'Completed',
        cost: 2200,
        notes: 'Applied NPK mix to promote vegetative growth.',
        metadata: {
          fertilizerName: 'NPK 19-19-19',
          quantity: 50,
          applicationMethod: 'Broadcasting',
        },
      },
      {
        id: 'a-soy-4',
        cropId: 'c-mock-soybean',
        type: 'Field Inspection',
        date: sowingSoybean + 55 * ONE_DAY,
        status: 'Completed',
        cost: 0,
        notes: 'Crop healthy. Early flowering seen. No pests.',
      },
      {
        id: 'a-soy-5',
        cropId: 'c-mock-soybean',
        type: 'Irrigation',
        date: now + ONE_DAY,
        status: 'Scheduled',
        cost: 250,
        notes: 'Drip irrigation to support flowering.',
        metadata: { irrigationMethod: 'Drip', duration: 45, waterQuantity: 1500 },
      },
      {
        id: 'a-soy-6',
        cropId: 'c-mock-soybean',
        type: 'Spray Application',
        date: now + 8 * ONE_DAY,
        status: 'Scheduled',
        cost: 1800,
        notes: 'Preventive neem spray against sucking pests.',
        metadata: {
          chemicalName: 'Organic Neem Oil',
          dosage: '500 ml/ha',
          waterQuantity: 200,
          targetPest: 'Aphids & Thrips',
        },
      },
      {
        id: 'a-wheat-1',
        cropId: 'c-mock-wheat',
        type: 'Sowing',
        date: sowingWheat,
        status: 'Completed',
        cost: 8000,
        notes: 'HD-2967 wheat variety sown.',
      },
      {
        id: 'a-wheat-2',
        cropId: 'c-mock-wheat',
        type: 'Fertilizer Application',
        date: now + 5 * ONE_DAY,
        status: 'Scheduled',
        cost: 3000,
        notes: 'NPK top dressing after germination.',
        metadata: { fertilizerName: 'Urea / NPK', quantity: 75, applicationMethod: 'Broadcasting' },
      },
    ];
    work.forEach((w) => this.addActivity(w));
  }
}
