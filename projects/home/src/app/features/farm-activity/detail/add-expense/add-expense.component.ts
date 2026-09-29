import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from 'shared';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivityExpensesService } from '../activity-expenses.service';
import { ActivityExpense } from '../../../activity/activity.models';
import { ReferenceDataService } from '../../../../core/api/reference-data.service';
import { ReferenceNamePipe } from '../../../../core/i18n/reference-name.pipe';
import { ReferenceItem } from '../../../../core/api/contracts';

@Component({
  selector: 'app-add-expense',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ReferenceNamePipe],
  templateUrl: './add-expense.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddExpenseComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly expensesService = inject(ActivityExpensesService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly activityId = input.required<number>();
  readonly added = output<ActivityExpense>();
  readonly cancelled = output<void>();

  /** Real expense categories (id + name) — loaded on init, never hardcoded. */
  readonly categoriesList = signal<ReferenceItem[]>([]);

  readonly expenseForm: FormGroup = this.fb.group({
    expenseCategoryId: [null as number | null, Validators.required],
    itemId: [''],
    resourceId: [''],
    quantity: [null as number | null],
    unit: [''],
    rate: [null as number | null],
    amount: [null as number | null, [Validators.required, Validators.min(0)]],
    remarks: [''],
  });

  ngOnInit(): void {
    void this.referenceDataService.listExpenseCategories().then((categories) => {
      this.categoriesList.set(categories);
      if (!this.expenseForm.get('expenseCategoryId')?.value && categories.length > 0) {
        this.expenseForm.patchValue({ expenseCategoryId: categories[0].id });
      }
    });
  }

  constructor() {
    // Automatically calculate Amount = Quantity * Rate
    this.expenseForm.valueChanges.subscribe((val) => {
      const qty = val.quantity;
      const rate = val.rate;
      if (qty != null && rate != null && qty >= 0 && rate >= 0) {
        const calculated = qty * rate;
        if (this.expenseForm.get('amount')?.value !== calculated) {
          this.expenseForm.patchValue({ amount: calculated }, { emitEvent: false });
        }
      }
    });
  }

  async submit(): Promise<void> {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const val = this.expenseForm.value;
    try {
      const expense = await this.expensesService.addExpense(this.activityId(), {
        expenseCategoryId: Number(val.expenseCategoryId),
        itemId: val.itemId?.trim() || undefined,
        resourceId: val.resourceId?.trim() || undefined,
        quantity: val.quantity ?? undefined,
        unit: val.unit?.trim() || undefined,
        rate: val.rate ?? undefined,
        amount: val.amount,
        remarks: val.remarks?.trim() || undefined,
      });
      this.resetForm();
      this.added.emit(expense);
    } catch {
      this.toast.error(this.translate.instant('addExpense.saveError'));
    }
  }

  cancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private resetForm(): void {
    this.expenseForm.reset({
      expenseCategoryId: this.categoriesList()[0]?.id ?? null,
      itemId: '',
      resourceId: '',
      quantity: null,
      unit: '',
      rate: null,
      amount: null,
      remarks: '',
    });
  }
}
