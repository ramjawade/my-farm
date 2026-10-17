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
import { parseId } from '../../../core/models/entity-id';
import { CropTimelineService } from '../crop-timeline.service';
import { SALE_UNIT_SUGGESTIONS } from './crop-sale.models';
import { CropSalesService } from './crop-sales.service';

const positive = (control: AbstractControl): ValidationErrors | null =>
  Number(control.value) > 0 ? null : { positive: true };

/** Local calendar date as `YYYY-MM-DD`. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Records a sale of a crop, or edits one; the same page serves both. */
@Component({
  selector: 'app-sale-form',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './sale-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sales = inject(CropSalesService);
  private readonly timeline = inject(CropTimelineService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly units = SALE_UNIT_SUGGESTIONS;
  readonly cropId = signal<number | null>(null);
  readonly saleId = signal<number | null>(null);
  readonly isEdit = computed(() => this.saleId() !== null);
  readonly tried = signal(false);
  readonly saving = signal(false);

  /** The crop being sold, written as name and field, shown locked. */
  readonly cropName = computed(() => {
    const id = this.cropId();
    return (id ? this.timeline.getCropById(id)?.name : '') ?? '';
  });

  readonly form: FormGroup = this.fb.group({
    soldOn: [todayIso(), Validators.required],
    quantity: [null as number | null, [Validators.required, positive]],
    unit: ['', Validators.required],
    rate: [null as number | null, [Validators.required, positive]],
    amount: [null as number | null, [Validators.required, positive]],
    buyer: [''],
    notes: [''],
  });

  constructor() {
    // Amount follows quantity × rate while both are numbers; the farmer can type over it.
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
    this.cropId.set(parseId(params.get('cropId')));
    const editId = parseId(params.get('saleId'));
    void this.timeline.reload();
    if (editId) {
      this.saleId.set(editId);
      await this.loadSale(editId);
    }
  }

  private async loadSale(saleId: number): Promise<void> {
    const cropId = this.cropId();
    if (!cropId) return this.goBack();
    try {
      const sale = (await this.sales.list(cropId)).find((s) => s.id === saleId);
      if (!sale) return this.goBack();
      // Without events, so the saved amount is not replaced by quantity × rate.
      this.form.patchValue(
        {
          soldOn: sale.soldOn,
          quantity: sale.quantity,
          unit: sale.unit,
          rate: sale.rate,
          amount: sale.amount,
          buyer: sale.buyer ?? '',
          notes: sale.notes ?? '',
        },
        { emitEvent: false },
      );
    } catch {
      this.toast.error(this.translate.instant('saleForm.loadError'));
      this.goBack();
    }
  }

  /** True when a control is wrong and a save has been tried. */
  showError(name: string): boolean {
    return this.tried() && !!this.form.get(name)?.invalid;
  }

  /** The unit message shows under Quantity when only the unit is missing. */
  quantityMessage(): string {
    return this.form.get('quantity')?.invalid
      ? 'saleForm.quantityRequired'
      : 'saleForm.unitRequired';
  }

  showQuantityError(): boolean {
    return this.showError('quantity') || this.showError('unit');
  }

  async submit(): Promise<void> {
    this.tried.set(true);
    const cropId = this.cropId();
    if (this.form.invalid || !cropId || this.saving()) return;

    const val = this.form.getRawValue();
    const input = {
      soldOn: String(val.soldOn),
      quantity: Number(val.quantity),
      unit: String(val.unit).trim(),
      rate: Number(val.rate),
      amount: Number(val.amount),
      buyer: val.buyer?.trim() || undefined,
      notes: val.notes?.trim() || undefined,
    };

    this.saving.set(true);
    try {
      const saleId = this.saleId();
      if (saleId !== null) await this.sales.update(cropId, saleId, input);
      else await this.sales.add(cropId, input);
      this.toast.success(
        this.translate.instant(saleId !== null ? 'saleForm.updatedToast' : 'saleForm.addedToast'),
      );
      this.goBack();
    } catch {
      this.toast.error(this.translate.instant('saleForm.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.goBack();
  }

  private goBack(): void {
    const cropId = this.cropId();
    void this.router.navigate(cropId ? ['/crops', cropId] : ['/crops']);
  }
}
