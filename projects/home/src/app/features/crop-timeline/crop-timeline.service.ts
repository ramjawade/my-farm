import { Injectable, signal, inject, effect } from '@angular/core';
import { CropEntity, ActivityEntity, CropStage, ActivityType } from './crop-timeline.models';
import { AuthService } from '../../core/auth/auth.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';

const CROPS_STORAGE_KEY = 'my_farm_crops';
const ACTIVITIES_STORAGE_KEY = 'my_farm_crop_activities';

@Injectable({
  providedIn: 'root'
})
export class CropTimelineService {
  private readonly authService = inject(AuthService);
  private readonly farmActivityService = inject(FarmActivityService);
  private readonly cropsSignal = signal<CropEntity[]>([]);
  private readonly activitiesSignal = signal<ActivityEntity[]>([]);

  readonly crops = this.cropsSignal.asReadonly();
  readonly activities = this.activitiesSignal.asReadonly();

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadForUser(user.id);
      } else {
        this.cropsSignal.set([]);
        this.activitiesSignal.set([]);
      }
    });
  }

  private getUserCropsKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_crops` : CROPS_STORAGE_KEY;
  }

  private getUserActivitiesKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_crop_activities` : ACTIVITIES_STORAGE_KEY;
  }

  // --- Crop API ---
  addCrop(cropData: Omit<CropEntity, 'id'>): CropEntity {
    const newCrop: CropEntity = {
      ...cropData,
      id: 'c-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36)
    };

    const current = this.cropsSignal();
    const updated = [newCrop, ...current];
    this.cropsSignal.set(updated);
    this.saveCropsToStorage(updated);

    // Create 8 default activities for the crop lifecycle stages
    const stages: CropStage[] = [
      'Land Preparation',
      'Sowing',
      'Germination',
      'Vegetative Growth',
      'Flowering',
      'Fruiting / Pod Formation',
      'Maturity',
      'Harvest'
    ];

    const hasSowingDate = newCrop.sowingDate !== undefined && newCrop.sowingDate !== null;
    const sowingTime = hasSowingDate ? Number(newCrop.sowingDate) : 0;
    const oneDay = 24 * 60 * 60 * 1000;
    const offsets: Record<CropStage, number> = {
      'Land Preparation': -5 * oneDay,
      'Sowing': 0,
      'Germination': 7 * oneDay,
      'Vegetative Growth': 21 * oneDay,
      'Flowering': 45 * oneDay,
      'Fruiting / Pod Formation': 60 * oneDay,
      'Maturity': 90 * oneDay,
      'Harvest': 100 * oneDay
    };

    const currentStageIdx = stages.indexOf(newCrop.currentStage);

    stages.forEach((stage, idx) => {
      const type: ActivityType = stage === 'Sowing' ? 'Sowing' : (stage === 'Harvest' ? 'Harvest' : 'Field Inspection');
      const status = idx <= currentStageIdx ? 'Completed' : 'Planned';
      const date = (idx <= currentStageIdx && hasSowingDate) ? (sowingTime + offsets[stage]) : undefined;
      const notes = `Growth stage advanced to: ${stage}.`;

      this.addActivity({
        cropId: newCrop.id,
        type,
        date,
        status,
        cost: 0,
        notes,
        attachments: [],
        metadata: {}
      });
    });

    return newCrop;
  }

  updateCrop(id: string, updates: Partial<CropEntity>): void {
    const current = this.cropsSignal();
    const updated = current.map(c => c.id === id ? { ...c, ...updates } : c);
    this.cropsSignal.set(updated);
    this.saveCropsToStorage(updated);
  }

  deleteCrop(id: string): void {
    // Delete crop
    const currentCrops = this.cropsSignal();
    const updatedCrops = currentCrops.filter(c => c.id !== id);
    this.cropsSignal.set(updatedCrops);
    this.saveCropsToStorage(updatedCrops);

    // Cascading delete activities
    const currentActs = this.activitiesSignal();
    const updatedActs = currentActs.filter(a => a.cropId !== id);
    this.activitiesSignal.set(updatedActs);
    this.saveActivitiesToStorage(updatedActs);
  }

  // --- Activity API ---
  addActivity(activityData: Omit<ActivityEntity, 'id'> & { id?: string }): ActivityEntity {
    const newActivity: ActivityEntity = {
      ...activityData,
      id: activityData.id || ('a-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36))
    };

    const current = this.activitiesSignal();
    const updated = [newActivity, ...current];
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    // If this is a subactivity, verify if the parent is a planned stage activity
    if (newActivity.parentActivityId) {
      const parentAct = current.find(a => a.id === newActivity.parentActivityId);
      if (parentAct && parentAct.status === 'Planned') {
        // Mark parent as completed with the subactivity date
        this.updateActivity(parentAct.id, {
          status: 'Completed',
          date: newActivity.date
        });

        // Resolve stage name from parent notes, e.g. "Growth stage advanced to: Flowering."
        const match = parentAct.notes.match(/Growth stage advanced to:\s*(.+)\./);
        if (match && match[1]) {
          const stageName = match[1].trim() as CropStage;
          this.updateCrop(newActivity.cropId, { currentStage: stageName });
        }
      }
    }

    // Update expected upcoming activity in Crop if planned
    if (newActivity.status === 'Planned' || newActivity.status === 'Scheduled') {
      this.updateCropUpcomingActivity(newActivity.cropId);
    }

    // Sync to FarmActivityService
    this.syncToFarmActivity(newActivity);

    return newActivity;
  }

  updateActivityOnly(id: string, updates: Partial<ActivityEntity>): void {
    const current = this.activitiesSignal();
    const updated = current.map(a => a.id === id ? { ...a, ...updates, metadata: { ...a.metadata, ...updates.metadata } } : a);
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    const updatedAct = updated.find(a => a.id === id);
    if (updatedAct) {
      this.updateCropUpcomingActivity(updatedAct.cropId);
    }
  }

  updateActivity(id: string, updates: Partial<ActivityEntity>): void {
    this.updateActivityOnly(id, updates);

    // Sync update to FarmActivityService
    const updatedAct = this.activitiesSignal().find(a => a.id === id);
    if (updatedAct) {
      this.syncUpdateToFarmActivity(updatedAct);
    }
  }

  deleteActivityOnly(id: string): void {
    const current = this.activitiesSignal();
    const actToDelete = current.find(a => a.id === id);
    if (!actToDelete) return;

    const updated = current.filter(a => a.id !== id);
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    this.updateCropUpcomingActivity(actToDelete.cropId);
  }

  deleteActivity(id: string): void {
    this.deleteActivityOnly(id);

    // Cascading delete only on FarmActivityService side
    this.farmActivityService.deleteActivityOnly(id);
  }

  private syncToFarmActivity(ca: ActivityEntity): void {
    const farmActivityService = this.farmActivityService;
    if (!farmActivityService) return;

    // Check if general activity already exists
    const exists = farmActivityService.activities().find(g => g.id === ca.id);
    if (exists) return;

    const crop = this.cropsSignal().find(c => c.id === ca.cropId);
    const fieldId = crop?.fieldId;

    // Determine season from date
    const dateObj = ca.date ? new Date(ca.date) : new Date();
    const month = isNaN(dateObj.getTime()) ? new Date().getMonth() : dateObj.getMonth();
    let season = 'Kharif';
    if (month >= 9 || month <= 0) season = 'Rabi'; // Oct, Nov, Dec, Jan
    else if (month >= 1 && month <= 4) season = 'Summer'; // Feb, Mar, Apr, May

    // Map status
    let status: 'Draft' | 'In Progress' | 'Completed' = 'In Progress';
    if (ca.status === 'Completed') status = 'Completed';
    else if (ca.status === 'Planned' || ca.status === 'Scheduled') status = 'In Progress';

    // Add activity to FarmActivityService
    const ga = farmActivityService.addActivity({
      id: ca.id,
      date: ca.date || undefined,
      season,
      activityId: ca.type,
      cropId: ca.cropId,
      fieldId,
      status,
      notes: ca.notes,
      parentActivityId: ca.parentActivityId,
      attachments: ca.attachments
    });

    // Add expense if cost > 0
    if (ca.cost > 0) {
      let category = 'Other';
      if (ca.type === 'Sowing') category = 'Seeds';
      else if (ca.type === 'Fertilizer Application') category = 'Fertilizer';
      else if (ca.type === 'Labour Activity') category = 'Workers';
      else if (ca.type === 'Irrigation') category = 'Machine Rent';
      
      farmActivityService.addExpense({
        activityId: ga.id,
        category,
        itemId: ca.type + ' Cost',
        quantity: 1,
        unit: 'job',
        rate: ca.cost,
        amount: ca.cost,
        remarks: 'Auto-synced from Crop Timeline'
      });
    }
  }

  private syncUpdateToFarmActivity(ca: ActivityEntity): void {
    const farmActivityService = this.farmActivityService;
    if (!farmActivityService) return;

    const exists = farmActivityService.activities().find(g => g.id === ca.id);
    if (!exists) {
      this.syncToFarmActivity(ca);
      return;
    }

    let status: 'Draft' | 'In Progress' | 'Completed' = 'In Progress';
    if (ca.status === 'Completed') status = 'Completed';
    else if (ca.status === 'Planned' || ca.status === 'Scheduled') status = 'In Progress';

    farmActivityService.updateActivityOnly(ca.id, {
      date: ca.date || undefined,
      activityId: ca.type,
      status,
      notes: ca.notes,
      parentActivityId: ca.parentActivityId,
      attachments: ca.attachments
    });

    // Update expense
    const expenses = farmActivityService.getExpensesForActivity(ca.id);
    if (ca.cost > 0) {
      if (expenses.length > 0) {
        farmActivityService.updateExpense(expenses[0].id, {
          amount: ca.cost,
          rate: ca.cost
        });
      } else {
        let category = 'Other';
        if (ca.type === 'Sowing') category = 'Seeds';
        else if (ca.type === 'Fertilizer Application') category = 'Fertilizer';
        else if (ca.type === 'Labour Activity') category = 'Workers';
        else if (ca.type === 'Irrigation') category = 'Machine Rent';

        farmActivityService.addExpense({
          activityId: ca.id,
          category,
          itemId: ca.type + ' Cost',
          quantity: 1,
          unit: 'job',
          rate: ca.cost,
          amount: ca.cost,
          remarks: 'Auto-synced from Crop Timeline'
        });
      }
    } else {
      for (const e of expenses) {
        farmActivityService.deleteExpense(e.id);
      }
    }
  }

  getActivitiesForCrop(cropId: string): ActivityEntity[] {
    return this.activitiesSignal().filter(a => a.cropId === cropId);
  }

  findOrCreateMainActivityForStage(cropId: string, stage: CropStage): ActivityEntity {
    const activities = this.activitiesSignal().filter(a => a.cropId === cropId);

    // Look for an activity that represents this stage
    let mainAct = activities.find(a => 
      (a.type === 'Field Inspection' && a.notes.includes(`advanced to: ${stage}`)) ||
      (stage === 'Sowing' && a.type === 'Sowing') ||
      (stage === 'Harvest' && a.type === 'Harvest')
    );

    if (mainAct) {
      if (mainAct.status !== 'Completed') {
        this.updateActivity(mainAct.id, {
          status: 'Completed',
          date: Date.now()
        });
        // Retrieve the updated mainActivity record
        mainAct = this.activitiesSignal().find(a => a.id === mainAct!.id)!;
      }
    } else {
      const type: ActivityType = (stage === 'Sowing') ? 'Sowing' : (stage === 'Harvest' ? 'Harvest' : 'Field Inspection');
      mainAct = this.addActivity({
        cropId,
        type,
        date: undefined,
        status: 'Planned',
        cost: 0,
        notes: `Growth stage advanced to: ${stage}.`,
        attachments: [],
        metadata: {}
      });
    }

    return mainAct;
  }

  findMainActivityForStage(cropId: string, stage: CropStage): ActivityEntity | undefined {
    const activities = this.activitiesSignal().filter(a => a.cropId === cropId);
    return activities.find(a => 
      (a.type === 'Field Inspection' && a.notes.includes(`advanced to: ${stage}`)) ||
      (stage === 'Sowing' && a.type === 'Sowing') ||
      (stage === 'Harvest' && a.type === 'Harvest')
    );
  }

  // --- Helper to update Crop's upcomingActivity field based on closest planned task ---
  private updateCropUpcomingActivity(cropId: string): void {
    const cropActivities = this.activitiesSignal().filter(a => a.cropId === cropId && !a.parentActivityId);
    const planned = cropActivities
      .filter(a => a.status === 'Planned' || a.status === 'Scheduled')
      .sort((a, b) => {
        const timeA = a.date !== undefined ? a.date : Infinity;
        const timeB = b.date !== undefined ? b.date : Infinity;
        return timeA - timeB;
      });

    if (planned.length > 0) {
      const nextAct = planned[0];
      if (nextAct.date) {
        const dateDiff = nextAct.date - Date.now();
        const days = Math.ceil(dateDiff / (1000 * 60 * 60 * 24));
        
        let relativeDay = '';
        if (days <= 0) relativeDay = 'Today';
        else if (days === 1) relativeDay = 'Tomorrow';
        else relativeDay = `In ${days} Days`;

        this.updateCrop(cropId, { upcomingActivity: `${nextAct.type} (${relativeDay})` });
      } else {
        this.updateCrop(cropId, { upcomingActivity: nextAct.type });
      }
    } else {
      this.updateCrop(cropId, { upcomingActivity: undefined });
    }
  }

  // --- Storage & Seeding Operations ---
  private loadForUser(userId: string): void {
    try {
      const cropsKey = `my_farm_${userId}_crops`;
      const actsKey = `my_farm_${userId}_crop_activities`;
      const storedCrops = localStorage.getItem(cropsKey);
      const storedActivities = localStorage.getItem(actsKey);

      if (storedCrops) {
        this.cropsSignal.set(JSON.parse(storedCrops));
      } else {
        this.cropsSignal.set([]);
      }

      if (storedActivities) {
        this.activitiesSignal.set(JSON.parse(storedActivities));
      } else {
        this.activitiesSignal.set([]);
      }

      // Seed mock records for default user if storage is empty
      if (userId === 'f-default' && (!storedCrops || JSON.parse(storedCrops).length === 0)) {
        this.seedMockData();
      }
    } catch (e) {
      console.error('Failed to load crop activities from storage', e);
      if (userId === 'f-default') {
        this.seedMockData();
      }
    }
  }

  private saveCropsToStorage(crops: CropEntity[]): void {
    try {
      localStorage.setItem(this.getUserCropsKey(), JSON.stringify(crops));
    } catch (e) {
      console.error('Failed to save crops to local storage', e);
    }
  }

  private saveActivitiesToStorage(activities: ActivityEntity[]): void {
    try {
      localStorage.setItem(this.getUserActivitiesKey(), JSON.stringify(activities));
    } catch (e) {
      console.error('Failed to save activities to local storage', e);
    }
  }

  private seedMockData(): void {
    const today = new Date();
    
    // Seed Crop 1: Soybean
    const sowingSoybean = new Date();
    sowingSoybean.setDate(today.getDate() - 65); // 65 days ago

    const expectedHarvestSoybean = new Date();
    expectedHarvestSoybean.setDate(today.getDate() + 45); // expected harvest in 45 days

    const crop1: CropEntity = {
      id: 'c-mock-soybean',
      fieldId: 'Field A',
      name: 'Soybeans',
      cropType: 'Soybeans',
      area: 2.0,
      areaUnit: 'hectares',
      sowingDate: sowingSoybean.getTime(),
      currentStage: 'Flowering',
      status: 'Active',
      expectedHarvestDate: expectedHarvestSoybean.getTime(),
      upcomingActivity: 'Irrigation (Tomorrow)'
    };

    // Seed Crop 2: Wheat
    const sowingWheat = new Date();
    sowingWheat.setDate(today.getDate() - 15); // 15 days ago

    const crop2: CropEntity = {
      id: 'c-mock-wheat',
      fieldId: 'Field B',
      name: 'Wheat',
      cropType: 'Wheat',
      area: 4.5,
      areaUnit: 'hectares',
      sowingDate: sowingWheat.getTime(),
      currentStage: 'Germination',
      status: 'Active',
      upcomingActivity: 'Fertilizer Application (In 5 Days)'
    };

    const initialCrops = [crop1, crop2];
    this.cropsSignal.set(initialCrops);
    this.saveCropsToStorage(initialCrops);

    // Calculate dates for default Soybean stages
    const oneDay = 24 * 60 * 60 * 1000;
    const soyLandDate = sowingSoybean.getTime() - 5 * oneDay;
    const soyGermDate = sowingSoybean.getTime() + 7 * oneDay;
    const soyVegDate = sowingSoybean.getTime() + 21 * oneDay;
    const soyFlowDate = sowingSoybean.getTime() + 45 * oneDay;

    const soyStageLand: ActivityEntity = {
      id: 'a-soy-stage-land',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: soyLandDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Land Preparation.',
      attachments: [],
      metadata: {}
    };
    const soyStageGerm: ActivityEntity = {
      id: 'a-soy-stage-germ',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: soyGermDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Germination.',
      attachments: [],
      metadata: {}
    };
    const soyStageVeg: ActivityEntity = {
      id: 'a-soy-stage-veg',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: soyVegDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Vegetative Growth.',
      attachments: [],
      metadata: {}
    };
    const soyStageFlow: ActivityEntity = {
      id: 'a-soy-stage-flow',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: soyFlowDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Flowering.',
      attachments: [],
      metadata: {}
    };
    const soyStageFruit: ActivityEntity = {
      id: 'a-soy-stage-fruit',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Fruiting / Pod Formation.',
      attachments: [],
      metadata: {}
    };
    const soyStageMat: ActivityEntity = {
      id: 'a-soy-stage-mat',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Maturity.',
      attachments: [],
      metadata: {}
    };
    const soyStageHarv: ActivityEntity = {
      id: 'a-soy-stage-harv',
      cropId: 'c-mock-soybean',
      type: 'Harvest',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Harvest.',
      attachments: [],
      metadata: {}
    };

    // Calculate dates for default Wheat stages
    const wheatLandDate = sowingWheat.getTime() - 5 * oneDay;
    const wheatGermDate = sowingWheat.getTime() + 7 * oneDay;

    const wheatStageLand: ActivityEntity = {
      id: 'a-wheat-stage-land',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: wheatLandDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Land Preparation.',
      attachments: [],
      metadata: {}
    };
    const wheatStageGerm: ActivityEntity = {
      id: 'a-wheat-stage-germ',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: wheatGermDate,
      status: 'Completed',
      cost: 0,
      notes: 'Growth stage advanced to: Germination.',
      attachments: [],
      metadata: {}
    };
    const wheatStageVeg: ActivityEntity = {
      id: 'a-wheat-stage-veg',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Vegetative Growth.',
      attachments: [],
      metadata: {}
    };
    const wheatStageFlow: ActivityEntity = {
      id: 'a-wheat-stage-flow',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Flowering.',
      attachments: [],
      metadata: {}
    };
    const wheatStageFruit: ActivityEntity = {
      id: 'a-wheat-stage-fruit',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Fruiting / Pod Formation.',
      attachments: [],
      metadata: {}
    };
    const wheatStageMat: ActivityEntity = {
      id: 'a-wheat-stage-mat',
      cropId: 'c-mock-wheat',
      type: 'Field Inspection',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Maturity.',
      attachments: [],
      metadata: {}
    };
    const wheatStageHarv: ActivityEntity = {
      id: 'a-wheat-stage-harv',
      cropId: 'c-mock-wheat',
      type: 'Harvest',
      date: undefined,
      status: 'Planned',
      cost: 0,
      notes: 'Growth stage advanced to: Harvest.',
      attachments: [],
      metadata: {}
    };

    // Seed Activities for Crop 1: Soybean
    const activity1: ActivityEntity = {
      id: 'a-soy-1',
      cropId: 'c-mock-soybean',
      type: 'Sowing',
      date: sowingSoybean.getTime(),
      status: 'Completed',
      cost: 4500,
      notes: 'Soybean sown successfully using mechanical seed drill under optimal moisture conditions.',
      attachments: [],
      metadata: {}
    };

    const weedingDate = new Date(sowingSoybean);
    weedingDate.setDate(weedingDate.getDate() + 20); // 20 days after sowing
    const activity2: ActivityEntity = {
      id: 'a-soy-2',
      cropId: 'c-mock-soybean',
      type: 'Weeding',
      date: weedingDate.getTime(),
      status: 'Completed',
      cost: 1500,
      notes: 'Manual weeding performed. Field clear of broadleaf weeds.',
      attachments: [],
      metadata: {}
    };

    const fertilizerDate = new Date(sowingSoybean);
    fertilizerDate.setDate(fertilizerDate.getDate() + 35); // 35 days after sowing
    const activity3: ActivityEntity = {
      id: 'a-soy-3',
      cropId: 'c-mock-soybean',
      type: 'Fertilizer Application',
      date: fertilizerDate.getTime(),
      status: 'Completed',
      cost: 2200,
      notes: 'Applied NPK mix to promote vegetative growth.',
      attachments: [],
      metadata: {
        fertilizerName: 'NPK 19-19-19',
        quantity: 50,
        applicationMethod: 'Broadcasting'
      }
    };

    const inspectionDate = new Date(sowingSoybean);
    inspectionDate.setDate(inspectionDate.getDate() + 55); // 55 days after sowing
    const activity4: ActivityEntity = {
      id: 'a-soy-4',
      cropId: 'c-mock-soybean',
      type: 'Field Inspection',
      date: inspectionDate.getTime(),
      status: 'Completed',
      cost: 0,
      notes: 'Crop condition healthy. Initial flowering stages detected. No sign of pests.',
      attachments: [],
      metadata: {}
    };

    // Seed upcoming planned activities
    const nextIrrDate = new Date();
    nextIrrDate.setDate(today.getDate() + 1); // tomorrow
    const activity5: ActivityEntity = {
      id: 'a-soy-5',
      cropId: 'c-mock-soybean',
      type: 'Irrigation',
      date: nextIrrDate.getTime(),
      status: 'Planned',
      cost: 250,
      notes: 'Scheduled drip irrigation to support active flowering period.',
      attachments: [],
      metadata: {
        irrigationMethod: 'Drip',
        duration: 45,
        waterQuantity: 1500
      }
    };

    const nextSprayDate = new Date();
    nextSprayDate.setDate(today.getDate() + 8); // in 8 days
    const activity6: ActivityEntity = {
      id: 'a-soy-6',
      cropId: 'c-mock-soybean',
      type: 'Spray Application',
      date: nextSprayDate.getTime(),
      status: 'Planned',
      cost: 1800,
      notes: 'Planned preventative organic neem spray against sucking pests.',
      attachments: [],
      metadata: {
        chemicalName: 'Organic Neem Oil',
        dosage: '500 ml/ha',
        waterQuantity: 200,
        targetPest: 'Aphids & Thrips'
      }
    };

    // Seed Activities for Crop 2: Wheat
    const wheatSowingAct: ActivityEntity = {
      id: 'a-wheat-1',
      cropId: 'c-mock-wheat',
      type: 'Sowing',
      date: sowingWheat.getTime(),
      status: 'Completed',
      cost: 8000,
      notes: 'High yield HD-2967 wheat variety sown successfully.',
      attachments: [],
      metadata: {}
    };

    const wheatNextFertDate = new Date();
    wheatNextFertDate.setDate(today.getDate() + 5); // in 5 days
    const wheatFertAct: ActivityEntity = {
      id: 'a-wheat-2',
      cropId: 'c-mock-wheat',
      type: 'Fertilizer Application',
      date: wheatNextFertDate.getTime(),
      status: 'Planned',
      cost: 3000,
      notes: 'NPK top dressing planned post germination.',
      attachments: [],
      metadata: {
        fertilizerName: 'Urea / NPK',
        quantity: 75,
        applicationMethod: 'Broadcasting'
      }
    };

    const subActivity1: ActivityEntity = {
      id: 'a-soy-1-sub1',
      cropId: 'c-mock-soybean',
      parentActivityId: 'a-soy-1',
      type: 'Labour Activity',
      date: sowingSoybean.getTime(),
      status: 'Completed',
      cost: 500,
      notes: 'Helpers loading seeds and checking drill calibration.',
      attachments: [],
      metadata: {}
    };

    const initialActivities = [
      soyStageLand,
      activity1, // Sowing stage
      subActivity1,
      soyStageGerm,
      soyStageVeg,
      soyStageFlow,
      soyStageFruit,
      soyStageMat,
      soyStageHarv,
      activity2,
      activity3,
      activity4,
      activity5,
      activity6,
      wheatStageLand,
      wheatSowingAct, // Sowing stage
      wheatStageGerm,
      wheatStageVeg,
      wheatStageFlow,
      wheatStageFruit,
      wheatStageMat,
      wheatStageHarv,
      wheatFertAct
    ];
    this.activitiesSignal.set(initialActivities);
    this.saveActivitiesToStorage(initialActivities);
  }
}
