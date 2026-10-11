import { LocalNumberPipe } from '../../../../core/i18n/localized.pipes';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  input,
  output,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivityExpensesService } from '../activity-expenses.service';
import { ActivityExpense } from '../../../activity/activity.models';
import { ReferenceNamePipe } from '../../../../core/i18n/reference-name.pipe';
import { ReferenceDataService } from '../../../../core/api/reference-data.service';

const SPLIT_TONES = ['success', 'warning', 'info', 'danger', 'primary', 'secondary'];

/** The activity's expenses: the total, a split bar and a row per expense. */
@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [LocalNumberPipe, ConfirmDialogComponent, RouterLink, TranslatePipe, ReferenceNamePipe],
  templateUrl: './expense-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseListComponent implements OnInit {
  private readonly expensesService = inject(ActivityExpensesService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly referenceData = inject(ReferenceDataService);

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
      this.error = this.translate.instant('expenseList.loadError');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  categoryName(expenseCategoryId: number): string {
    return this.referenceData.expenseCategoryName(expenseCategoryId);
  }

  total(): number {
    return this.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  percent(expense: ActivityExpense): number {
    const total = this.total();
    return total ? Math.round((expense.amount / total) * 100) : 0;
  }

  /** Bootstrap colour of the i-th slice in the split bar. */
  tone(index: number): string {
    return SPLIT_TONES[index % SPLIT_TONES.length];
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
      this.toast.success(this.translate.instant('expenseList.removedToast'));
      this.changed.emit();
    } catch {
      this.toast.error(this.translate.instant('expenseList.removeError'));
    } finally {
      this.selectedExpenseId = null;
      this.cdr.markForCheck();
    }
  }
}
