import { Component, ChangeDetectionStrategy, inject, input, output, signal, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { ActivityExpensesService } from '../activity-expenses.service';
import { ActivityExpense } from '../../../activity/activity.models';
import { expenseCategoryIcon } from '../../../activity/activity-display';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [DecimalPipe, ConfirmDialogComponent],
  templateUrl: './expense-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseListComponent {
  private readonly expensesService = inject(ActivityExpensesService);
  private readonly toast = inject(ToastService);

  readonly activityId = input.required<number>();
  readonly changed = output<void>();

  readonly expenses = signal<ActivityExpense[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly showDeleteConfirm = signal(false);
  readonly selectedExpenseId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const id = this.activityId();
      void this.reload(id);
    });
  }

  async reload(activityId: number = this.activityId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.expenses.set(await this.expensesService.getExpenses(activityId));
    } catch {
      this.error.set('Could not load expenses. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  getCategoryIcon(category: string): string {
    return expenseCategoryIcon(category as any);
  }

  deleteExpense(expenseId: number): void {
    this.selectedExpenseId.set(expenseId);
    this.showDeleteConfirm.set(true);
  }

  async confirmDeleteExpense(): Promise<void> {
    const expenseId = this.selectedExpenseId();
    if (expenseId === null) return;
    try {
      await this.expensesService.deleteExpense(this.activityId(), expenseId);
      this.expenses.update((exps) => exps.filter((e) => e.id !== expenseId));
      this.toast.success('Expense removed.');
      this.changed.emit();
    } catch {
      this.toast.error('Could not remove the expense. Please try again.');
    } finally {
      this.selectedExpenseId.set(null);
    }
  }
}
