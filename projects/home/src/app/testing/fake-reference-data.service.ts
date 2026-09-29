import { Injectable } from '@angular/core';

/**
 * `ReferenceDataService` backed by fixed in-memory tables — no HTTP. Ids are
 * the 1-based position in each list, so tests can rely on them.
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

  preload(): void {
    // no-op
  }

  async expenseCategoryIdForName(name: string): Promise<number> {
    return this.expenseCategories.indexOf(name) + 1;
  }

  expenseCategoryName(id: number | null | undefined): string {
    return this.expenseCategories[(id ?? 0) - 1] ?? '';
  }
}
