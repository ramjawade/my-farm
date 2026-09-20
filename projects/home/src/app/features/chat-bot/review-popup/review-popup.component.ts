import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ChatEntryService, ResolvedEntry } from '../../../core/api/chat-entry.service';
import { CropsApiService } from '../../../core/api/crops-api.service';
import { LandsApiService } from '../../../core/api/lands-api.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity } from '../../activity/activity.models';
import { EXPENSE_CATEGORIES } from '../chat-decision';

type ExpenseLineGroup = FormGroup<{ category: FormControl<string>; amount: FormControl<string> }>;

/**
 * Review/confirm popup (#259). The only path to creation: nothing is
 * written to the backend until the farmer taps Save here. Cancel makes no
 * backend call at all.
 *
 * Owns the actual `ChatEntryService.create()` call — unlike #257's chat
 * panel, this sub-issue's own scope is "the popup + wiring to the create
 * call", so the backend wiring lives here rather than in a presentational
 * shell.
 */
@Component({
  selector: 'app-review-popup',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './review-popup.component.html',
  styleUrl: './review-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPopupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly chatEntry = inject(ChatEntryService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly landsApi = inject(LandsApiService);
  private readonly cropsApi = inject(CropsApiService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  readonly entry = input<ResolvedEntry | null>(null);
  readonly originalInput = input('');
  readonly model = input('');

  readonly saved = output<Activity>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly activityTypeOptions = signal<string[]>([]);
  readonly landOptions = signal<{ id: number; name: string }[]>([]);
  readonly cropOptions = signal<{ id: number; name: string }[]>([]);
  readonly expenseCategoryOptions = EXPENSE_CATEGORIES;

  readonly form = this.fb.nonNullable.group({
    activityType: [''],
    date: [''],
    landId: this.fb.control<number | null>(null),
    cropId: this.fb.control<number | null>(null),
    expenses: this.fb.array<ExpenseLineGroup>([]),
  });

  get expensesArray(): FormArray<ExpenseLineGroup> {
    return this.form.controls.expenses;
  }

  constructor() {
    effect(() => {
      const current = this.entry();
      if (!current) return;
      this.errorMessage.set(null);
      this.populateForm(current);
      void this.loadOptions();
    });
  }

  private populateForm(current: ResolvedEntry): void {
    this.expensesArray.clear();
    this.form.patchValue({
      activityType: current.activity_type,
      date: current.date ? current.date.slice(0, 10) : '',
      landId: current.land_id,
      cropId: current.crop_id,
    });
    for (const line of current.expenses) {
      this.expensesArray.push(
        this.fb.nonNullable.group({
          category: [line.category ?? ''],
          amount: [line.amount ?? ''],
        }),
      );
    }
  }

  private async loadOptions(): Promise<void> {
    const userId = this.auth.currentUser()?.id ?? 0;
    const [types, lands, crops] = await Promise.all([
      this.referenceData.listActivityTypes(),
      this.landsApi.getFarms(userId),
      this.cropsApi.getCrops(userId),
    ]);
    this.activityTypeOptions.set(types.map((t) => t.name));
    this.landOptions.set(lands.map((l) => ({ id: l.id, name: l.name })));
    this.cropOptions.set(crops.map((c) => ({ id: c.id, name: c.name })));
  }

  async save(): Promise<void> {
    const current = this.entry();
    if (!current || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const raw = this.form.getRawValue();
      const edited: ResolvedEntry = {
        ...current,
        activity_type: raw.activityType,
        date: raw.date || null,
        land_id: raw.landId,
        land: raw.landId
          ? (this.landOptions().find((l) => l.id === raw.landId)?.name ?? null)
          : null,
        crop_id: raw.cropId,
        crop: raw.cropId
          ? (this.cropOptions().find((c) => c.id === raw.cropId)?.name ?? null)
          : null,
        expenses: current.expenses.map((line, i) => ({
          ...line,
          category: raw.expenses[i]?.category ?? line.category,
          amount: raw.expenses[i]?.amount ?? line.amount,
        })),
      };

      const activity = await this.chatEntry.create(edited, this.originalInput(), this.model());
      this.saved.emit(activity);
    } catch {
      this.errorMessage.set(this.translate.instant('chatBot.review.saveFailed'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    if (this.saving()) return;
    this.cancelled.emit();
  }
}
