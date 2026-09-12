import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  input,
  output,
  OnInit,
} from '@angular/core';
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
export class ExpenseListComponent implements OnInit {
  private readonly expensesService = inject(ActivityExpensesService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly activityId = input.required<number>();
  readonly changed = output<void>();

  expenses: ActivityExpense[] = [];
  loading = false;
  error: string | null = null;

  showDeleteConfirm = false;
  selectedExpenseId: number | null = null;

  ngOnInit(): void {
    void this.reload();
  }

  async reload(activityId: number = this.activityId()): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      this.expenses = await this.expensesService.getExpenses(activityId);
    } catch {
      this.error = 'Could not load expenses. Please try again.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  getCategoryIcon(category: string): string {
    return expenseCategoryIcon(category as any);
  }

  deleteExpense(expenseId: number): void {
    this.selectedExpenseId = expenseId;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  async confirmDeleteExpense(): Promise<void> {
    const expenseId = this.selectedExpenseId;
    if (expenseId === null) return;
    try {
      await this.expensesService.deleteExpense(this.activityId(), expenseId);
      this.expenses = this.expenses.filter((e) => e.id !== expenseId);
      this.toast.success('Expense removed.');
      this.changed.emit();
    } catch {
      this.toast.error('Could not remove the expense. Please try again.');
    } finally {
      this.selectedExpenseId = null;
      this.cdr.markForCheck();
    }
  }
}
