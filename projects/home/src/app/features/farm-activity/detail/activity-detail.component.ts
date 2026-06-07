import { Component, inject, computed, ChangeDetectionStrategy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { FarmActivityService } from '../farm-activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { ConfirmDialogComponent } from 'shared';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DatePipe, ConfirmDialogComponent],
  templateUrl: './activity-detail.component.html',
  styleUrl: './activity-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  
  readonly activityService = inject(FarmActivityService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);

  readonly showExpenseModal = signal(false);
  readonly showDeleteActivityConfirm = signal(false);
  readonly showDeleteExpenseConfirm = signal(false);
  readonly selectedExpenseId = signal<string | null>(null);

  // Extract ID from routing params reactive signal
  private readonly routeParams$ = this.route.paramMap.pipe(map(params => params.get('id') || ''));
  readonly activityId = toSignal(this.routeParams$, { initialValue: '' });

  // Get current activity
  readonly activity = computed(() => {
    const id = this.activityId();
    return this.activityService.activities().find(a => a.id === id);
  });

  // Get current activity expenses
  readonly expenses = computed(() => {
    const id = this.activityId();
    return this.activityService.expenses().filter(e => e.activityId === id);
  });

  readonly totalCost = computed(() => {
    return this.expenses().reduce((sum, e) => sum + e.amount, 0);
  });

  // Resolve Linked crop
  readonly cropName = computed(() => {
    const act = this.activity();
    if (!act || !act.cropId) return '';
    const crop = this.cropService.crops().find(c => c.id === act.cropId);
    return crop ? crop.name : 'Unknown Crop';
  });

  // Resolve Linked field
  readonly fieldName = computed(() => {
    const act = this.activity();
    if (!act || !act.fieldId) return '';
    const farm = this.farmDrawService.savedFarms().find(f => f.id === act.fieldId);
    return farm ? farm.name : act.fieldId;
  });

  // Resolve category icons dynamically
  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'Transport': return 'bi-truck';
      case 'Machine Rent': return 'bi-tools';
      case 'Workers': return 'bi-people';
      case 'Seeds': return 'bi-flower1';
      case 'Fertilizer': return 'bi-moisture';
      case 'Pesticides': return 'bi-shield-shaded';
      case 'Irrigation Fuel': return 'bi-droplet-half';
      default: return 'bi-box-seam';
    }
  }

  // Dynamic chronological timeline of events
  readonly timelineEvents = computed(() => {
    const act = this.activity();
    if (!act) return [];

    const events: Array<{
      title: string;
      detail?: string;
      timestamp: number;
      isSuccess?: boolean;
    }> = [];

    // 1. Created Event
    events.push({
      title: 'Activity Created',
      timestamp: act.createdAt
    });

    // 2. Expenses Events
    const expensesList = this.expenses();
    expensesList.forEach(exp => {
      events.push({
        title: 'Expense Added',
        detail: `${exp.itemId || exp.category} - ₹${exp.amount.toLocaleString()}`,
        timestamp: exp.createdAt
      });
    });

    // 3. Completed Event
    if (act.status === 'Completed') {
      events.push({
        title: 'Activity Completed',
        timestamp: act.updatedAt,
        isSuccess: true
      });
    }

    // Sort chronologically (oldest to newest)
    return events.sort((a, b) => a.timestamp - b.timestamp);
  });

  // Expense form
  readonly expenseForm: FormGroup = this.fb.group({
    category: ['Workers', Validators.required],
    itemId: [''],
    resourceId: [''],
    quantity: [null as number | null],
    unit: [''],
    rate: [null as number | null],
    amount: [null as number | null, [Validators.required, Validators.min(0)]],
    remarks: ['']
  });

  // Pre-configured category list
  readonly categoriesList = [
    'Workers',
    'Machine Rent',
    'Transport',
    'Seeds',
    'Fertilizer',
    'Pesticides',
    'Irrigation Fuel',
    'Other'
  ];

  constructor() {
    // Automatically calculate Amount = Quantity * Rate
    this.expenseForm.valueChanges.subscribe(val => {
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

  updateStatus(newStatus: string): void {
    const act = this.activity();
    if (act) {
      this.activityService.updateActivity(act.id, { status: newStatus as any });
    }
  }

  updateNotes(newNotes: string): void {
    const act = this.activity();
    if (act) {
      this.activityService.updateActivity(act.id, { notes: newNotes.trim() || undefined });
    }
  }

  deleteActivity(): void {
    this.showDeleteActivityConfirm.set(true);
  }

  confirmDeleteActivity(): void {
    const act = this.activity();
    if (act) {
      this.activityService.deleteActivity(act.id);
      this.router.navigate(['/activities']);
    }
  }

  addExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const id = this.activityId();
    if (!id) return;

    const val = this.expenseForm.value;
    this.activityService.addExpense({
      activityId: id,
      category: val.category,
      itemId: val.itemId?.trim() || undefined,
      resourceId: val.resourceId?.trim() || undefined,
      quantity: val.quantity ?? undefined,
      unit: val.unit?.trim() || undefined,
      rate: val.rate ?? undefined,
      amount: val.amount,
      remarks: val.remarks?.trim() || undefined
    });

    this.closeExpenseModal();
  }

  openExpenseModal(): void {
    this.showExpenseModal.set(true);
  }

  closeExpenseModal(): void {
    this.showExpenseModal.set(false);
    this.expenseForm.reset({
      category: 'Workers',
      itemId: '',
      resourceId: '',
      quantity: null,
      unit: '',
      rate: null,
      amount: null,
      remarks: ''
    });
  }

  deleteExpense(expenseId: string): void {
    this.selectedExpenseId.set(expenseId);
    this.showDeleteExpenseConfirm.set(true);
  }

  confirmDeleteExpense(): void {
    const expenseId = this.selectedExpenseId();
    if (expenseId) {
      this.activityService.deleteExpense(expenseId);
      this.selectedExpenseId.set(null);
    }
  }
}
