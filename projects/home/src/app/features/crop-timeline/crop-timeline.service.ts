import { Injectable, signal } from '@angular/core';
import { CropEntity, ActivityEntity, CropStage } from './crop-timeline.models';

const CROPS_STORAGE_KEY = 'my_farm_crops';
const ACTIVITIES_STORAGE_KEY = 'my_farm_crop_activities';

@Injectable({
  providedIn: 'root'
})
export class CropTimelineService {
  private readonly cropsSignal = signal<CropEntity[]>([]);
  private readonly activitiesSignal = signal<ActivityEntity[]>([]);

  readonly crops = this.cropsSignal.asReadonly();
  readonly activities = this.activitiesSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
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
  addActivity(activityData: Omit<ActivityEntity, 'id'>): ActivityEntity {
    const newActivity: ActivityEntity = {
      ...activityData,
      id: 'a-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36)
    };

    const current = this.activitiesSignal();
    const updated = [newActivity, ...current];
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    // Update expected upcoming activity in Crop if planned
    if (newActivity.status === 'Planned' || newActivity.status === 'Scheduled') {
      this.updateCropUpcomingActivity(newActivity.cropId);
    }

    return newActivity;
  }

  updateActivity(id: string, updates: Partial<ActivityEntity>): void {
    const current = this.activitiesSignal();
    const updated = current.map(a => a.id === id ? { ...a, ...updates, metadata: { ...a.metadata, ...updates.metadata } } : a);
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    const updatedAct = updated.find(a => a.id === id);
    if (updatedAct) {
      this.updateCropUpcomingActivity(updatedAct.cropId);
    }
  }

  deleteActivity(id: string): void {
    const current = this.activitiesSignal();
    const actToDelete = current.find(a => a.id === id);
    if (!actToDelete) return;

    const updated = current.filter(a => a.id !== id);
    this.activitiesSignal.set(updated);
    this.saveActivitiesToStorage(updated);

    this.updateCropUpcomingActivity(actToDelete.cropId);
  }

  getActivitiesForCrop(cropId: string): ActivityEntity[] {
    return this.activitiesSignal().filter(a => a.cropId === cropId);
  }

  // --- Helper to update Crop's upcomingActivity field based on closest planned task ---
  private updateCropUpcomingActivity(cropId: string): void {
    const cropActivities = this.activitiesSignal().filter(a => a.cropId === cropId);
    const planned = cropActivities
      .filter(a => a.status === 'Planned' || a.status === 'Scheduled')
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    if (planned.length > 0) {
      const nextAct = planned[0];
      const dateDiff = Date.parse(nextAct.date) - Date.now();
      const days = Math.ceil(dateDiff / (1000 * 60 * 60 * 24));
      
      let relativeDay = '';
      if (days <= 0) relativeDay = 'Today';
      else if (days === 1) relativeDay = 'Tomorrow';
      else relativeDay = `In ${days} Days`;

      this.updateCrop(cropId, { upcomingActivity: `${nextAct.type} (${relativeDay})` });
    } else {
      this.updateCrop(cropId, { upcomingActivity: undefined });
    }
  }

  // --- Storage & Seeding Operations ---
  private loadFromStorage(): void {
    try {
      const storedCrops = localStorage.getItem(CROPS_STORAGE_KEY);
      const storedActivities = localStorage.getItem(ACTIVITIES_STORAGE_KEY);

      if (storedCrops) {
        this.cropsSignal.set(JSON.parse(storedCrops));
      }
      if (storedActivities) {
        this.activitiesSignal.set(JSON.parse(storedActivities));
      }

      // Seed mock records if storage is empty
      if (!storedCrops || JSON.parse(storedCrops).length === 0) {
        this.seedMockData();
      }
    } catch (e) {
      console.error('Failed to load crop activities from storage', e);
      this.seedMockData();
    }
  }

  private saveCropsToStorage(crops: CropEntity[]): void {
    try {
      localStorage.setItem(CROPS_STORAGE_KEY, JSON.stringify(crops));
    } catch (e) {
      console.error('Failed to save crops to local storage', e);
    }
  }

  private saveActivitiesToStorage(activities: ActivityEntity[]): void {
    try {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
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
      area: 2.0,
      areaUnit: 'hectares',
      sowingDate: sowingSoybean.toISOString(),
      currentStage: 'Flowering',
      status: 'Active',
      expectedHarvestDate: expectedHarvestSoybean.toISOString(),
      upcomingActivity: 'Irrigation (Tomorrow)'
    };

    // Seed Crop 2: Wheat
    const sowingWheat = new Date();
    sowingWheat.setDate(today.getDate() - 15); // 15 days ago

    const crop2: CropEntity = {
      id: 'c-mock-wheat',
      fieldId: 'Field B',
      name: 'Wheat',
      area: 4.5,
      areaUnit: 'hectares',
      sowingDate: sowingWheat.toISOString(),
      currentStage: 'Germination',
      status: 'Active',
      upcomingActivity: 'Fertilizer Application (In 5 Days)'
    };

    const initialCrops = [crop1, crop2];
    this.cropsSignal.set(initialCrops);
    this.saveCropsToStorage(initialCrops);

    // Seed Activities for Crop 1: Soybean
    const activity1: ActivityEntity = {
      id: 'a-soy-1',
      cropId: 'c-mock-soybean',
      type: 'Sowing',
      date: sowingSoybean.toISOString(),
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
      date: weedingDate.toISOString(),
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
      date: fertilizerDate.toISOString(),
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
      date: inspectionDate.toISOString(),
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
      date: nextIrrDate.toISOString(),
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
      date: nextSprayDate.toISOString(),
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
      date: sowingWheat.toISOString(),
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
      date: wheatNextFertDate.toISOString(),
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

    const initialActivities = [
      activity1,
      activity2,
      activity3,
      activity4,
      activity5,
      activity6,
      wheatSowingAct,
      wheatFertAct
    ];
    this.activitiesSignal.set(initialActivities);
    this.saveActivitiesToStorage(initialActivities);
  }
}
