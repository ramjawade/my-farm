import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { NewListData } from './prices-data';
import {
  MAX_LISTS,
  MAX_LIST_NAME,
  RESERVED_LIST_NAME,
  WatchlistsService,
  refusalOf,
} from './watchlists.service';

/** Creates a watchlist from a name. */
@Component({
  selector: 'app-new-list',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './new-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly watchlists = inject(WatchlistsService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  /** Resolved before the page opens (see `newListResolver`). */
  readonly data = input.required<NewListData>();

  protected readonly maxName = MAX_LIST_NAME;
  protected readonly maxLists = MAX_LISTS;
  protected readonly tried = signal(false);
  protected readonly saving = signal(false);
  /** The backend refused the name after the page's own checks passed (a race). */
  protected readonly serverTaken = signal(false);

  private readonly names = computed(() => {
    const data = this.data();
    return data.status === 'ok' ? data.names.map((n) => n.toLowerCase()) : [];
  });
  protected readonly full = computed(() => this.names().length >= MAX_LISTS);

  /** Blank, a repeat of one of the farmer's lists, or the built-in "My farm" tab. */
  private readonly allowed = (control: AbstractControl): ValidationErrors | null => {
    const name = String(control.value ?? '')
      .trim()
      .toLowerCase();
    if (!name) return { required: true };
    if (name === RESERVED_LIST_NAME || this.names().includes(name)) return { taken: true };
    return null;
  };

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [this.allowed, Validators.maxLength(MAX_LIST_NAME)]],
  });

  /** The key of the message under the field, or null. */
  protected nameMessage(): string | null {
    const control = this.form.controls.name;
    if (this.serverTaken()) return 'prices.listNameTaken';
    if (!this.tried() || control.valid) return null;
    if (control.hasError('required')) return 'prices.listNameRequired';
    if (control.hasError('taken')) return 'prices.listNameTaken';
    return 'prices.listNameTooLong';
  }

  protected async submit(): Promise<void> {
    this.tried.set(true);
    this.serverTaken.set(false);
    if (this.form.invalid || this.full() || this.saving()) return;

    this.saving.set(true);
    try {
      const created = await this.watchlists.create(this.form.controls.name.value.trim());
      this.toast.success(this.translate.instant('prices.listCreated'));
      await this.router.navigate(['/prices'], { queryParams: { list: created.id } });
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal === 'name_taken' || refusal === 'reserved_name') this.serverTaken.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
