import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { ReferenceItem } from '../../../core/api/contracts';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { resolveReferenceName } from '../../../core/i18n/reference-name';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { parseId } from '../../../core/models/entity-id';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { ActivityService } from '../../activity/activity.service';
import { ActivityExpensesService } from '../detail/activity-expenses.service';

const UNIT_SUGGESTIONS = ['hours', 'days', 'bags', 'litres', 'kg'];

const positive = (control: AbstractControl): ValidationErrors | null =>
  Number(control.value) > 0 ? null : { positive: true };

/** Adds an expense to an activity, or edits one; the same page serves both. */
@Component({
  selector: 'app-expense-form',
  imports: [ReactiveFormsModule, TranslatePipe, ReferenceNamePipe],
  templateUrl: './expense-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly activityService = inject(ActivityService);
  private readonly expensesService = inject(ActivityExpensesService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly farmDraw = inject(FarmDrawService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly units = UNIT_SUGGESTIONS;

  /** Set when editing: the expense being changed. */
  readonly expenseId = signal<number | null>(null);
  readonly isEdit = computed(() => this.expenseId() !== null);
  readonly tried = signal(false);
  readonly saving = signal(false);
  readonly categories = signal<ReferenceItem[]>([]);
  private readonly farms = signal<SavedFarm[]>([]);
  private from = '';

  readonly form: FormGroup = this.fb.group({
    activityId: [null as number | null, Validators.required],
    expenseCategoryId: [null as number | null, Validators.required],
    itemId: [''],
    resourceId: [''],
    quantity: [null as number | null],
    unit: [''],
    rate: [null as number | null],
    amount: [null as number | null, [Validators.required, positive]],
    remarks: [''],
  });

  /** The farmer's activities, newest first, each written as type, date and field. */
  readonly activityOptions = computed(() =>
    [...this.activityService.activities()]
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
      .map((act) => {
        const type = resolveReferenceName(
          this.translate,
          'activity',
          this.referenceData.activityTypeName(act.activityTypeId),
        );
        const field = this.farms().find((f) => f.id === act.fieldId)?.name;
        const parts = [type, act.date ? this.locale.date(act.date, 'dd MMM') : '', field ?? ''];
        return { id: act.id, label: parts.filter(Boolean).join(' · ') };
      }),
  );

  constructor() {
    // Amount follows quantity × rate while both are numbers; the farmer can type over it.
    // Only a change to quantity or rate recalculates, so a typed amount is kept.
    const recalculate = (): void => {
      const { quantity, rate } = this.form.getRawValue();
      if (quantity != null && rate != null && quantity >= 0 && rate >= 0) {
        this.form.patchValue({ amount: quantity * rate }, { emitEvent: false });
      }
    };
    this.form.get('quantity')?.valueChanges.subscribe(recalculate);
    this.form.get('rate')?.valueChanges.subscribe(recalculate);
  }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.paramMap;
    const query = this.route.snapshot.queryParamMap;
    this.from = query.get('from') ?? '';
    const editId = parseId(params.get('expenseId'));
    const activityId = parseId(params.get('activityId')) ?? parseId(query.get('activityId'));

    if (activityId) this.form.patchValue({ activityId });
    if (editId) {
      this.expenseId.set(editId);
      this.form.get('activityId')?.disable();
    }

    const user = this.auth.currentUser();
    if (user) void this.farmDraw.loadFarms(user.id).then((farms) => this.farms.set(farms));
    void this.referenceData.listExpenseCategories().then((list) => this.categories.set(list));

    if (editId && activityId) await this.loadExpense(activityId, editId);
  }

  private async loadExpense(activityId: number, expenseId: number): Promise<void> {
    try {
      const expense = (await this.expensesService.getExpenses(activityId)).find(
        (e) => e.id === expenseId,
      );
      if (!expense) return this.goBack();
      // Without events, so the saved amount is not replaced by quantity × rate.
      this.form.patchValue(
        {
          expenseCategoryId: expense.expenseCategoryId,
          itemId: expense.itemId ?? '',
          resourceId: expense.resourceId ?? '',
          quantity: expense.quantity ?? null,
          unit: expense.unit ?? '',
          rate: expense.rate ?? null,
          amount: expense.amount,
          remarks: expense.remarks ?? '',
        },
        { emitEvent: false },
      );
    } catch {
      this.toast.error(this.translate.instant('expenseForm.loadError'));
      this.goBack();
    }
  }

  /** True when a required control is wrong and a save has been tried. */
  showError(name: string): boolean {
    return this.tried() && !!this.form.get(name)?.invalid;
  }

  async submit(): Promise<void> {
    this.tried.set(true);
    if (this.form.invalid) return;
    if (this.saving()) return;

    const val = this.form.getRawValue();
    const fields = {
      expenseCategoryId: Number(val.expenseCategoryId),
      itemId: val.itemId?.trim() || undefined,
      resourceId: val.resourceId?.trim() || undefined,
      quantity: val.quantity ?? undefined,
      unit: val.unit?.trim() || undefined,
      rate: val.rate ?? undefined,
      amount: Number(val.amount),
      remarks: val.remarks?.trim() || undefined,
    };

    this.saving.set(true);
    try {
      const editId = this.expenseId();
      if (editId !== null) {
        await this.activityService.saveExpenseChanges(editId, fields);
      } else {
        await this.activityService.addExpense({ activityId: Number(val.activityId), ...fields });
      }
      this.toast.success(
        this.translate.instant(
          editId !== null ? 'expenseForm.updatedToast' : 'expenseForm.addedToast',
        ),
      );
      this.goBack();
    } catch {
      this.toast.error(this.translate.instant('addExpense.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.goBack();
  }

  /** Back to the list when that is where the farmer came from, else to the activity. */
  private goBack(): void {
    const activityId = this.form.getRawValue().activityId;
    if (this.from === 'list' || !activityId) {
      void this.router.navigate(['/activities/list']);
    } else {
      void this.router.navigate(['/activities', activityId]);
    }
  }
}
