import { Injectable } from '@angular/core';

import { ReferenceItem } from '../core/api/contracts';
import { ActivityType } from '../features/activity/activity.models';

/**
 * `ReferenceDataService` backed by fixed in-memory tables — no HTTP. Ids are
 * the 1-based position in each list, so tests can rely on them
 * (e.g. Sowing = 1, Irrigation = 2, Weeding = 5, Harvest = 8).
 */
@Injectable()
export class FakeReferenceDataService {
  readonly expenseCategories = [
    'Machine Rent',
    'Labour',
    'Seeds',
    'Fertilizer',
    'Pesticide',
    'Transport',
    'Water',
    'Equipment',
    'Fuel',
    'Other',
  ];

  readonly activityTypes: ActivityType[] = [
    'Sowing',
    'Irrigation',
    'Fertilizer Application',
    'Spray Application',
    'Weeding',
    'Field Inspection',
    'Labour Activity',
    'Harvest',
    'Sale',
    'Weather Incident',
    'Maintenance',
    'Custom',
  ];

  preload(): void {
    // no-op
  }

  async ready(): Promise<void> {
    // always loaded
  }

  async expenseCategoryIdForName(name: string): Promise<number> {
    return this.expenseCategories.indexOf(name) + 1;
  }

  expenseCategoryName(id: number | null | undefined): string {
    return this.expenseCategories[(id ?? 0) - 1] ?? '';
  }

  async activityTypeIdForName(name: string): Promise<number> {
    return this.activityTypes.indexOf(name as ActivityType) + 1;
  }

  activityTypeName(id: number | null | undefined): string {
    return this.activityTypes[(id ?? 0) - 1] ?? '';
  }

  isActivityType(id: number | null | undefined, name: ActivityType): boolean {
    return this.activityTypeName(id) === name;
  }

  async listActivityTypes(): Promise<ReferenceItem[]> {
    return this.activityTypes.map((name, i) => ({ id: i + 1, name }));
  }

  async listExpenseCategories(): Promise<ReferenceItem[]> {
    return this.expenseCategories.map((name, i) => ({ id: i + 1, name }));
  }
}
