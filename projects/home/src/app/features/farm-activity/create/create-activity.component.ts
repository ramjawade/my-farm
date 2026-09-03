import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  OnInit,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { ToastService } from 'shared';

@Component({
  selector: 'app-create-activity',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './create-activity.component.html',
  styleUrl: './create-activity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateActivityComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly activityService = inject(ActivityService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly toast = inject(ToastService);

  @Input() cropId?: string;
  @Input() parentActivityId?: string;
  @Input() activityId?: string;
  @Input() isModal = false;

  @Output() readonly activitySaved = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  // Form group definition
  readonly form: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), Validators.required],
    season: ['Kharif', Validators.required],
    type: ['', Validators.required],
    cropId: [''],
    fieldId: [''],
    parentActivityId: [''],
    status: ['Completed', Validators.required],
    notes: [''],
  });

  constructor() {
    // Automatically apply auto-selection reactively when signal data lists load/change
    effect(
      () => {
        const crops = this.crops();
        const fields = this.savedFarms();

        // Auto-select crop if only one exists and form cropId is not set
        const currentCropId = this.form.get('cropId')?.value;
        if (!currentCropId && crops.length === 1) {
          const singleCrop = crops[0];
          this.form.patchValue({ cropId: singleCrop.id });
        }

        // Auto-select field if only one exists and form fieldId is not set
        const currentFieldId = this.form.get('fieldId')?.value;
        if (!currentFieldId && fields.length === 1) {
          const singleField = fields[0];
          this.form.patchValue({ fieldId: singleField.id });
        }
      },
      { allowSignalWrites: true },
    );
  }

  // Populate dropdowns from services
  readonly crops = this.cropService.crops;
  readonly savedFarms = this.farmDrawService.savedFarms;

  readonly selectedCropId = signal<string>('');

  // Pre-defined common suggestions
  readonly commonActivitySuggestions = [
    'Bore Installation',
    'Sowing',
    'Sowing Support',
    'Weeding',
    'Fertilizing',
    'Pest Spraying',
    'Harvesting',
    'Irrigation',
    'Field Inspection',
    'Tillage',
  ];

  readonly uploadedImages = signal<string[]>([]);

  readonly availableParentActivities = computed(() => {
    const cropId = this.selectedCropId();
    if (!cropId) return [];
    return this.cropService.activities().filter((a) => a.cropId === cropId && !a.parentActivityId);
  });

  ngOnInit(): void {
    // 1. If we are running in modal mode, inputs might be passed directly
    if (this.cropId) {
      this.form.patchValue({ cropId: this.cropId });
      this.selectedCropId.set(this.cropId);
    }
    if (this.parentActivityId) {
      this.form.patchValue({ parentActivityId: this.parentActivityId });
    }

    // 2. If we are running in route mode, read from query parameters
    if (!this.isModal) {
      this.route.queryParams.subscribe((params) => {
        const routeCropId = params['cropId'];
        const routeParentId = params['parentActivityId'];
        const routeActivityId = params['activityId'];

        if (routeCropId) {
          this.form.patchValue({ cropId: routeCropId });
          this.selectedCropId.set(routeCropId);
        }
        if (routeParentId) {
          this.form.patchValue({ parentActivityId: routeParentId });
        }
        if (routeActivityId) {
          this.activityId = routeActivityId;
        }
      });
    }

    // 3. Load existing activity for editing if activityId is present
    if (this.activityId) {
      const act = this.activityService.activities().find((a) => a.id === this.activityId);
      if (act) {
        this.form.patchValue({
          date: act.date ? new Date(act.date).toISOString().substring(0, 10) : '',
          season: act.season,
          type: act.type,
          cropId: act.cropId || '',
          fieldId: act.fieldId || '',
          parentActivityId: act.parentActivityId || '',
          status: act.status,
          notes: act.notes || '',
        });
        if (act.cropId) {
          this.selectedCropId.set(act.cropId);
        }
        this.uploadedImages.set(act.attachments || []);
      }
    }

    // Subscribe to form cropId changes to update the signal reactively.
    // The land is derived from the crop (an activity can't be on a crop in one
    // land and a different land), so the field control follows the crop.
    this.form.get('cropId')!.valueChanges.subscribe((val) => {
      this.selectedCropId.set(val || '');
      this.applyFieldFromCrop(val || '');
    });
    this.applyFieldFromCrop(this.form.get('cropId')?.value || '');
  }

  /** True when a crop is linked: the land is then derived and not user-editable. */
  readonly fieldLockedToCrop = computed(() => !!this.selectedCropId());

  private applyFieldFromCrop(cropId: string): void {
    const fieldControl = this.form.get('fieldId');
    if (!fieldControl) return;
    if (!cropId) {
      if (fieldControl.disabled) fieldControl.enable({ emitEvent: false });
      return;
    }
    const crop = this.crops().find((c) => c.id === cropId);
    fieldControl.setValue(crop?.fieldId || '', { emitEvent: false });
    if (fieldControl.enabled) fieldControl.disable({ emitEvent: false });
  }

  selectSuggestion(val: string): void {
    this.form.patchValue({ type: val });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = () => {
        const base64String = reader.result as string;
        this.uploadedImages.update((current) => [...current, base64String]);
      };

      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.uploadedImages.update((current) => current.filter((_, i) => i !== index));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();

    if (this.activityId) {
      // Update existing activity
      const updates: Record<string, any> = {
        season: val.season,
        type: val.type.trim(),
        status: val.status,
        notes: val.notes?.trim() || undefined,
        parentActivityId: val.parentActivityId || undefined,
        attachments: this.uploadedImages(),
      };
      if (val.date) {
        updates['date'] = new Date(val.date).getTime();
      }
      if (val.cropId) {
        updates['cropId'] = val.cropId;
      }
      updates['fieldId'] = val.fieldId || undefined;
      this.activityService.updateActivity(this.activityId, updates);
      this.toast.success('Activity updated.');
    } else {
      // Create activity
      const newAct = this.activityService.addActivity({
        date: val.date ? new Date(val.date).getTime() : Date.now(),
        season: val.season,
        type: val.type.trim(),
        cropId: val.cropId || undefined,
        fieldId: val.fieldId || undefined,
        status: val.status,
        notes: val.notes?.trim() || undefined,
        parentActivityId: val.parentActivityId || undefined,
        attachments: this.uploadedImages(),
      });

      this.toast.success(`${newAct.type === 'Custom' ? 'Activity' : newAct.type} logged.`);

      if (!this.isModal) {
        this.router.navigate(['/activities', newAct.id]);
        return;
      }
    }

    if (this.isModal) {
      this.activitySaved.emit();
    } else {
      this.router.navigate(['/activities']);
    }
  }

  onCancel(): void {
    if (this.isModal) {
      this.cancelled.emit();
    } else {
      this.router.navigate(['/activities']);
    }
  }
}
