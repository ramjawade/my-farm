import { Injectable, signal, computed, inject, effect, Injector } from '@angular/core';
import { Activity, ActivityExpense, ActivityStatus } from './farm-activity.models';
import { AuthService } from '../../core/auth/auth.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';

const ACTIVITIES_KEY = 'my_farm_activities';
const EXPENSES_KEY = 'my_farm_activity_expenses';

@Injectable({
  providedIn: 'root'
})
export class FarmActivityService {
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly activitiesSignal = signal<Activity[]>([]);
  private readonly expensesSignal = signal<ActivityExpense[]>([]);

  readonly activities = this.activitiesSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadForUser(user.id);
      } else {
        this.activitiesSignal.set([]);
        this.expensesSignal.set([]);
      }
    });
  }

  private getUserActivitiesKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_activities` : ACTIVITIES_KEY;
  }

  private getUserExpensesKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_activity_expenses` : EXPENSES_KEY;
  }

  // --- Storage Operations ---
  private loadForUser(userId: string): void {
    try {
      const actsKey = `my_farm_${userId}_activities`;
      const expsKey = `my_farm_${userId}_activity_expenses`;
      const storedActivities = localStorage.getItem(actsKey);
      const storedExpenses = localStorage.getItem(expsKey);

      if (storedActivities && storedExpenses) {
        this.activitiesSignal.set(JSON.parse(storedActivities));
        this.expensesSignal.set(JSON.parse(storedExpenses));
      } else {
        this.activitiesSignal.set([]);
        this.expensesSignal.set([]);
        
        // Seed default user if empty
        if (userId === 'f-default') {
          this.seedMockData();
        }
      }
    } catch (e) {
      console.error('Failed to load farm activities from storage', e);
      if (userId === 'f-default') {
        this.seedMockData();
      }
    }
  }

  private saveActivities(activities: Activity[]): void {
    try {
      localStorage.setItem(this.getUserActivitiesKey(), JSON.stringify(activities));
    } catch (e) {
      console.error('Failed to save activities to storage', e);
    }
  }

  private saveExpenses(expenses: ActivityExpense[]): void {
    try {
      localStorage.setItem(this.getUserExpensesKey(), JSON.stringify(expenses));
    } catch (e) {
      console.error('Failed to save expenses to storage', e);
    }
  }

  // --- Activity API ---
  addActivity(activityData: Omit<Activity, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): Activity {
    const id = activityData.id || ('act-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36));
    const newActivity: Activity = {
      ...activityData,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const current = this.activitiesSignal();
    const updated = [newActivity, ...current];
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);

    // Sync to CropTimelineService if linked to a crop
    if (newActivity.cropId) {
      this.syncToCropTimeline(newActivity);
    }

    return newActivity;
  }

  updateActivityOnly(id: string, updates: Partial<Activity>): void {
    const current = this.activitiesSignal();
    const updated = current.map(a => 
      a.id === id 
        ? { ...a, ...updates, updatedAt: Date.now() } 
        : a
    );
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
    this.updateActivityOnly(id, updates);

    // Sync to CropTimelineService
    const updatedAct = this.activitiesSignal().find(a => a.id === id);
    if (updatedAct && updatedAct.cropId) {
      this.syncUpdateToCropTimeline(updatedAct);
    }
  }

  deleteActivityOnly(id: string): void {
    // Delete activity
    const currentActs = this.activitiesSignal();
    const updatedActs = currentActs.filter(a => a.id !== id);
    this.activitiesSignal.set(updatedActs);
    this.saveActivities(updatedActs);

    // Cascading delete expenses
    const currentExp = this.expensesSignal();
    const updatedExp = currentExp.filter(e => e.activityId !== id);
    this.expensesSignal.set(updatedExp);
    this.saveExpenses(updatedExp);
  }

  deleteActivity(id: string): void {
    this.deleteActivityOnly(id);

    // Sync delete to CropTimelineService
    try {
      const cropTimelineService = this.injector.get(CropTimelineService);
      const exists = cropTimelineService.activities().find((a: any) => a.id === id);
      if (exists) {
        cropTimelineService.deleteActivityOnly(id);
      }
    } catch (e) {
      console.error('Lazy sync delete activity failed', e);
    }
  }

  // --- Expense API ---
  addExpense(expenseData: Omit<ActivityExpense, 'id' | 'createdAt'>): ActivityExpense {
    const newExpense: ActivityExpense = {
      ...expenseData,
      id: 'exp-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
      createdAt: Date.now()
    };

    const current = this.expensesSignal();
    const updated = [...current, newExpense];
    this.expensesSignal.set(updated);
    this.saveExpenses(updated);

    // Sync updated cost to crop timeline
    this.syncExpenseChangeToCropTimeline(newExpense.activityId);

    return newExpense;
  }

  updateExpense(id: string, updates: Partial<ActivityExpense>): void {
    const current = this.expensesSignal();
    const updated = current.map(e => e.id === id ? { ...e, ...updates } : e);
    this.expensesSignal.set(updated);
    this.saveExpenses(updated);

    const expense = updated.find(e => e.id === id);
    if (expense) {
      this.syncExpenseChangeToCropTimeline(expense.activityId);
    }
  }

  deleteExpense(id: string): void {
    const current = this.expensesSignal();
    const deletedExpense = current.find(e => e.id === id);
    const updated = current.filter(e => e.id !== id);
    this.expensesSignal.set(updated);
    this.saveExpenses(updated);

    // Sync updated cost to crop timeline
    if (deletedExpense) {
      this.syncExpenseChangeToCropTimeline(deletedExpense.activityId);
    }
  }

  private syncToCropTimeline(act: Activity): void {
    try {
      const cropTimelineService = this.injector.get(CropTimelineService);
      
      const exists = cropTimelineService.activities().find((a: any) => a.id === act.id);
      if (exists) return;

      let type: any = 'Field Inspection';
      const validTypes = ['Sowing', 'Irrigation', 'Fertilizer Application', 'Spray Application', 'Weeding', 'Field Inspection', 'Labour Activity', 'Harvest', 'Sale', 'Weather Incident'];
      if (validTypes.includes(act.activityId)) {
        type = act.activityId;
      } else if (act.activityId === 'Fertilizing') {
        type = 'Fertilizer Application';
      } else if (act.activityId === 'Pest Spraying') {
        type = 'Spray Application';
      } else if (act.activityId === 'Harvesting') {
        type = 'Harvest';
      }

      let status: any = 'Scheduled';
      if (act.status === 'Completed') status = 'Completed';
      else if (act.status === 'Draft') status = 'Planned';

      const cost = this.getTotalExpenseForActivity(act.id);

      cropTimelineService.addActivity({
        id: act.id,
        cropId: act.cropId!,
        type,
        date: act.date,
        status,
        cost,
        notes: act.notes || '',
        attachments: act.attachments || [],
        metadata: {},
        parentActivityId: act.parentActivityId
      });
    } catch (e) {
      console.error('Sync to CropTimelineService failed', e);
    }
  }

  private syncUpdateToCropTimeline(act: Activity): void {
    try {
      const cropTimelineService = this.injector.get(CropTimelineService);
      const exists = cropTimelineService.activities().find((a: any) => a.id === act.id);
      
      if (!exists) {
        this.syncToCropTimeline(act);
        return;
      }

      let type: any = 'Field Inspection';
      const validTypes = ['Sowing', 'Irrigation', 'Fertilizer Application', 'Spray Application', 'Weeding', 'Field Inspection', 'Labour Activity', 'Harvest', 'Sale', 'Weather Incident'];
      if (validTypes.includes(act.activityId)) {
        type = act.activityId;
      } else if (act.activityId === 'Fertilizing') {
        type = 'Fertilizer Application';
      } else if (act.activityId === 'Pest Spraying') {
        type = 'Spray Application';
      } else if (act.activityId === 'Harvesting') {
        type = 'Harvest';
      }

      let status: any = 'Scheduled';
      if (act.status === 'Completed') status = 'Completed';
      else if (act.status === 'Draft') status = 'Planned';

      const cost = this.getTotalExpenseForActivity(act.id);

      cropTimelineService.updateActivityOnly(act.id, {
        type,
        date: act.date,
        status,
        cost,
        notes: act.notes || '',
        parentActivityId: act.parentActivityId,
        attachments: act.attachments || []
      });
    } catch (e) {
      console.error('Sync update to CropTimelineService failed', e);
    }
  }

  private syncExpenseChangeToCropTimeline(activityId: string): void {
    try {
      const cropTimelineService = this.injector.get(CropTimelineService);
      const exists = cropTimelineService.activities().find((a: any) => a.id === activityId);
      if (exists) {
        const cost = this.getTotalExpenseForActivity(activityId);
        cropTimelineService.updateActivityOnly(activityId, { cost });
      }
    } catch (e) {
      // ignore
    }
  }

  getExpensesForActivity(activityId: string): ActivityExpense[] {
    return this.expensesSignal().filter(e => e.activityId === activityId);
  }

  getTotalExpenseForActivity(activityId: string): number {
    return this.getExpensesForActivity(activityId)
      .reduce((sum, exp) => sum + exp.amount, 0);
  }

  // --- Seed Data ---
  private seedMockData(): void {
    const mockActivities: Activity[] = [
      {
        id: 'mock-act-1',
        date: new Date('2026-06-01').getTime(),
        season: 'Summer',
        activityId: 'Bore Installation',
        fieldId: 'Field A',
        status: 'Completed',
        notes: 'Drilled deep bore well for supplemental irrigation during hot dry spells. Submersible pump set to 250ft.',
        createdAt: Date.now() - 6 * 24 * 3600 * 1000,
        updatedAt: Date.now() - 6 * 24 * 3600 * 1000
      },
      {
        id: 'mock-act-2',
        date: new Date('2026-05-15').getTime(),
        season: 'Kharif',
        activityId: 'Sowing Support',
        cropId: 'c-mock-soybean',
        fieldId: 'Field A',
        status: 'Completed',
        notes: 'Pre-sowing fertilizer spreading and manual field levelling.',
        createdAt: Date.now() - 23 * 24 * 3600 * 1000,
        updatedAt: Date.now() - 23 * 24 * 3600 * 1000
      },
      {
        id: 'mock-act-2-sub1',
        parentActivityId: 'mock-act-2',
        date: new Date('2026-05-15').getTime(),
        season: 'Kharif',
        activityId: 'Labour Activity',
        cropId: 'c-mock-soybean',
        fieldId: 'Field A',
        status: 'Completed',
        notes: 'Helpers loading seeds and checking drill calibration.',
        createdAt: Date.now() - 23 * 24 * 3600 * 1000,
        updatedAt: Date.now() - 23 * 24 * 3600 * 1000
      },
      {
        id: 'mock-act-3',
        date: new Date('2026-06-02').getTime(),
        season: 'Kharif',
        activityId: 'Weeding',
        cropId: 'c-mock-soybean',
        fieldId: 'Field A',
        status: 'Completed',
        notes: 'First round of manual mechanical weeding in Soybean plots.',
        createdAt: Date.now() - 5 * 24 * 3600 * 1000,
        updatedAt: Date.now() - 5 * 24 * 3600 * 1000
      },
      {
        id: 'mock-act-4',
        date: new Date('2026-06-06').getTime(),
        season: 'Rabi',
        activityId: 'Fertilizing',
        cropId: 'c-mock-wheat',
        fieldId: 'Field B',
        status: 'In Progress',
        notes: 'Spreading urea top dressing post crop germination. Light moisture present.',
        createdAt: Date.now() - 1 * 24 * 3600 * 1000,
        updatedAt: Date.now() - 1 * 24 * 3600 * 1000
      },
      {
        id: 'mock-act-5',
        date: new Date('2026-06-07').getTime(),
        season: 'Summer',
        activityId: 'Pest Spraying',
        cropId: 'c-mock-soybean',
        fieldId: 'Field A',
        status: 'Draft',
        notes: 'Organic neem spray solution planned to check early aphids infestation.',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const mockExpenses: ActivityExpense[] = [
      // Bore Installation expenses
      {
        id: 'mock-exp-1',
        activityId: 'mock-act-1',
        category: 'Machine Rent',
        itemId: 'Bore Rig Rigging',
        quantity: 1,
        unit: 'job',
        rate: 15000,
        amount: 15000,
        remarks: 'Contract rig drilling 250 feet',
        createdAt: Date.now() - 6 * 24 * 3600 * 1000
      },
      {
        id: 'mock-exp-2',
        activityId: 'mock-act-1',
        category: 'Workers',
        itemId: 'Labor charges',
        quantity: 5,
        unit: 'days',
        rate: 1000,
        amount: 5000,
        remarks: 'Rig operators and helpers',
        createdAt: Date.now() - 6 * 24 * 3600 * 1000
      },
      {
        id: 'mock-exp-3',
        activityId: 'mock-act-1',
        category: 'Transport',
        itemId: 'Rig transport fuel',
        quantity: 1,
        unit: 'trip',
        rate: 1950,
        amount: 1950,
        remarks: 'Tractor transport for rig tools',
        createdAt: Date.now() - 6 * 24 * 3600 * 1000
      },
      // Sowing Support expenses
      {
        id: 'mock-exp-4',
        activityId: 'mock-act-2',
        category: 'Seeds',
        itemId: 'Soybean Seeds Co.',
        quantity: 2,
        unit: 'bags',
        rate: 1500,
        amount: 3000,
        remarks: 'High-germination seed bag',
        createdAt: Date.now() - 23 * 24 * 3600 * 1000
      },
      {
        id: 'mock-exp-5',
        activityId: 'mock-act-2',
        category: 'Workers',
        itemId: 'Seed broadcasting',
        quantity: 3,
        unit: 'days',
        rate: 500,
        amount: 1500,
        remarks: 'Local farm hand labor',
        createdAt: Date.now() - 23 * 24 * 3600 * 1000
      },
      // Weeding expenses
      {
        id: 'mock-exp-6',
        activityId: 'mock-act-3',
        category: 'Workers',
        itemId: 'Manual weeding crew',
        quantity: 3,
        unit: 'days',
        rate: 500,
        amount: 1500,
        remarks: 'Hand weeding tools utilized',
        createdAt: Date.now() - 5 * 24 * 3600 * 1000
      },
      // Fertilizing expenses
      {
        id: 'mock-exp-7',
        activityId: 'mock-act-4',
        category: 'Fertilizer',
        itemId: 'Urea Premium',
        quantity: 2,
        unit: 'bags',
        rate: 1100,
        amount: 2200,
        remarks: 'Cooperative purchase',
        createdAt: Date.now() - 1 * 24 * 3600 * 1000
      },
      {
        id: 'mock-exp-8',
        activityId: 'mock-act-4',
        category: 'Workers',
        itemId: 'Urea spreading labor',
        quantity: 2,
        unit: 'days',
        rate: 400,
        amount: 800,
        remarks: 'Broadcasting completed in 4 hours',
        createdAt: Date.now() - 1 * 24 * 3600 * 1000
      },
      // Pest Spraying expenses
      {
        id: 'mock-exp-9',
        activityId: 'mock-act-5',
        category: 'Pesticides',
        itemId: 'Neem Oil Concentrate',
        quantity: 4,
        unit: 'litres',
        rate: 300,
        amount: 1200,
        remarks: 'Organic pesticide supply',
        createdAt: Date.now()
      }
    ];

    this.activitiesSignal.set(mockActivities);
    this.expensesSignal.set(mockExpenses);
    this.saveActivities(mockActivities);
    this.saveExpenses(mockExpenses);
  }
}
