import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  signal,
  viewChild,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { ActivityDetailService } from './activity-detail.service';
import { ExpenseListComponent } from './expense-list/expense-list.component';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmDialogComponent, ToastService } from 'shared';
import {
  Activity,
  ActivityDetailSummary,
  ActivityHistoryEntry,
  ActivityStatus,
} from '../../activity/activity.models';
import { parseId } from '../../../core/models/entity-id';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    ConfirmDialogComponent,
    ExpenseListComponent,
    AddExpenseComponent,
  ],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDetailComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly detailService = inject(ActivityDetailService);
  private readonly toast = inject(ToastService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly authService = inject(AuthService);

  private readonly expenseList = viewChild(ExpenseListComponent);

  readonly showExpenseModal = signal(false);
  readonly showDeleteActivityConfirm = signal(false);
  readonly savedFarms = signal<SavedFarm[]>([]);

  readonly activity = signal<Activity | null>(null);
  readonly summary = signal<ActivityDetailSummary | null>(null);
  readonly history = signal<ActivityHistoryEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly routeParams$ = this.route.paramMap.pipe(
    map((params) => parseId(params.get('id'))),
  );
  readonly activityId = toSignal(this.routeParams$, { initialValue: null });

  readonly cropName = computed(() => {
    const act = this.activity();
    if (!act || !act.cropId) return '';
    const crop = this.cropService.crops().find((c) => c.id === act.cropId);
    return crop ? crop.name : 'Unknown Crop';
  });

  readonly fieldName = computed(() => {
    const act = this.activity();
    if (!act || !act.fieldId) return '';
    const farm = this.savedFarms().find((f) => f.id === act.fieldId);
    return farm ? farm.name : String(act.fieldId);
  });

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      this.savedFarms.set(await this.farmDrawService.loadFarms(user.id));
    }

    const id = this.activityId();
    if (id) {
      await this.reload(id);
    } else {
      this.loading.set(false);
    }
  }

  private async reload(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [activity, summary, history] = await Promise.all([
        this.detailService.getActivity(id),
        this.detailService.getSummary(id),
        this.detailService.getHistory(id),
      ]);
      this.activity.set(activity);
      this.summary.set(summary);
      this.history.set(history);
    } catch {
      this.error.set('Could not load this activity. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Expense changes affect totals/history but not the activity record itself. */
  private async refreshSummary(): Promise<void> {
    const id = this.activityId();
    if (!id) return;
    try {
      const [summary, history] = await Promise.all([
        this.detailService.getSummary(id),
        this.detailService.getHistory(id),
      ]);
      this.summary.set(summary);
      this.history.set(history);
    } catch {
      this.toast.error('Could not refresh the activity summary.');
    }
  }

  onExpenseChanged(): void {
    void this.refreshSummary();
  }

  onExpenseAdded(): void {
    this.closeExpenseModal();
    this.expenseList()?.reload();
    void this.refreshSummary();
  }

  async updateStatus(newStatus: ActivityStatus): Promise<void> {
    const id = this.activityId();
    if (!id) return;
    try {
      const updated = await this.detailService.updateStatus(id, newStatus);
      this.activity.set(updated);
      void this.refreshSummary();
    } catch {
      this.toast.error('Could not update the status. Please try again.');
    }
  }

  deleteActivity(): void {
    this.showDeleteActivityConfirm.set(true);
  }

  async confirmDeleteActivity(): Promise<void> {
    const id = this.activityId();
    if (!id) return;
    try {
      await this.detailService.deleteActivity(id);
      this.toast.success('Activity deleted.');
      this.router.navigate(['/activities']);
    } catch {
      this.toast.error('Could not delete the activity. Please try again.');
    }
  }

  openExpenseModal(): void {
    this.showExpenseModal.set(true);
  }

  closeExpenseModal(): void {
    this.showExpenseModal.set(false);
  }
}
