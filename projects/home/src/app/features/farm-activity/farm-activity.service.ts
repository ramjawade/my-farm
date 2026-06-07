import { Injectable, signal, computed } from '@angular/core';
import { Activity, ActivityExpense, ActivityStatus } from './farm-activity.models';

const ACTIVITIES_KEY = 'my_farm_activities';
const EXPENSES_KEY = 'my_farm_activity_expenses';

@Injectable({
  providedIn: 'root'
})
export class FarmActivityService {
  private readonly activitiesSignal = signal<Activity[]>([]);
  private readonly expensesSignal = signal<ActivityExpense[]>([]);

  readonly activities = this.activitiesSignal.asReadonly();
  readonly expenses = this.expensesSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  // --- Storage Operations ---
  private loadFromStorage(): void {
    try {
      const storedActivities = localStorage.getItem(ACTIVITIES_KEY);
      const storedExpenses = localStorage.getItem(EXPENSES_KEY);

      if (storedActivities && storedExpenses) {
        this.activitiesSignal.set(JSON.parse(storedActivities));
        this.expensesSignal.set(JSON.parse(storedExpenses));
      } else {
        this.seedMockData();
      }
    } catch (e) {
      console.error('Failed to load farm activities from storage', e);
      this.seedMockData();
    }
  }

  private saveActivities(activities: Activity[]): void {
    try {
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
    } catch (e) {
      console.error('Failed to save activities to storage', e);
    }
  }

  private saveExpenses(expenses: ActivityExpense[]): void {
    try {
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    } catch (e) {
      console.error('Failed to save expenses to storage', e);
    }
  }

  // --- Activity API ---
  addActivity(activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Activity {
    const newActivity: Activity = {
      ...activityData,
      id: 'act-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const current = this.activitiesSignal();
    const updated = [newActivity, ...current];
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);

    return newActivity;
  }

  updateActivity(id: string, updates: Partial<Activity>): void {
    const current = this.activitiesSignal();
    const updated = current.map(a => 
      a.id === id 
        ? { ...a, ...updates, updatedAt: Date.now() } 
        : a
    );
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);
  }

  deleteActivity(id: string): void {
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

    return newExpense;
  }

  deleteExpense(id: string): void {
    const current = this.expensesSignal();
    const updated = current.filter(e => e.id !== id);
    this.expensesSignal.set(updated);
    this.saveExpenses(updated);
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
        date: '2026-06-01',
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
        date: '2026-05-15',
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
        id: 'mock-act-3',
        date: '2026-06-02',
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
        date: '2026-06-06',
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
        date: '2026-06-07',
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
