import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { ReferenceItem } from '../../../core/api/contracts';
import { parseId } from '../../../core/models/entity-id';
import { Activity } from '../../activity/activity.models';
import { ComboboxComponent, ToastService } from 'shared';

@Component({
  selector: 'app-create-activity',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ComboboxComponent],
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
  private readonly authService = inject(AuthService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly toast = inject(ToastService);

  private readonly cropIdPathParam = toSignal(
    this.route.paramMap.pipe(map((params) => parseId(params.get('cropId')))),
    { initialValue: null },
  );

  /** True when reached via a crop-scoped route (`crops/:cropId/create`), not just `?cropId=`. */
  readonly isCropScoped = computed(() => this.cropIdPathParam() !== null);

  /** Set when editing an existing activity, read from the `activityId` query param. */
  activityId?: number;

  // Form group definition
  readonly form: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), Validators.required],
    season: ['Kharif', Validators.required],
    type: ['', Validators.required],
    cropId: [null as number | null],
    fieldId: [null as number | null],
    parentActivityId: [null as number | null],
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
  readonly savedFarms = signal<SavedFarm[]>([]);

  readonly selectedCropId = signal<number | null>(null);
  readonly saving = signal(false);

  // Real activity-type reference data, backing the "Activity Name / Type" combobox.
  readonly referenceActivityTypes = signal<ReferenceItem[]>([]);
  readonly activityTypeNames = computed(() => this.referenceActivityTypes().map((t) => t.name));

  readonly uploadedImages = signal<string[]>([]);

  readonly availableParentActivities = computed(() => {
    const cropId = this.selectedCropId();
    if (!cropId) return [];
    return this.cropService.activities().filter((a) => a.cropId === cropId && !a.parentActivityId);
  });

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      void this.farmDrawService.loadFarms(user.id).then((farms) => this.savedFarms.set(farms));
    }

    void this.referenceDataService
      .listActivityTypes()
      .then((types) => this.referenceActivityTypes.set(types));

    // Read cropId from the route path param first (crops/:cropId/create),
    // falling back to the query param — parentActivityId/activityId stay
    // query-param only.
    this.route.queryParams.subscribe((params) => {
      const routeCropId = this.cropIdPathParam() ?? parseId(params['cropId']);
      const routeParentId = parseId(params['parentActivityId']);
      const routeActivityId = parseId(params['activityId']);

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

    // 3. Load existing activity for editing if activityId is present
    if (this.activityId) {
      const act = this.activityService.activities().find((a) => a.id === this.activityId);
      if (act) {
        this.form.patchValue({
          date: act.date ? new Date(act.date).toISOString().substring(0, 10) : '',
          season: act.season,
          type: act.type,
          cropId: act.cropId ?? null,
          fieldId: act.fieldId ?? null,
          parentActivityId: act.parentActivityId ?? null,
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
    this.form.get('cropId')!.valueChanges.subscribe((val: number | null) => {
      this.selectedCropId.set(val ?? null);
      this.applyFieldFromCrop(val ?? null);
    });
    this.applyFieldFromCrop(this.form.get('cropId')?.value ?? null);
  }

  /** True when a crop is linked: the land is then derived and not user-editable. */
  readonly fieldLockedToCrop = computed(() => !!this.selectedCropId());

  private applyFieldFromCrop(cropId: number | null): void {
    const fieldControl = this.form.get('fieldId');
    if (!fieldControl) return;
    if (!cropId) {
      if (fieldControl.disabled) fieldControl.enable({ emitEvent: false });
      return;
    }
    const crop = this.crops().find((c) => c.id === cropId);
    fieldControl.setValue(crop?.fieldId ?? null, { emitEvent: false });
    if (fieldControl.enabled) fieldControl.disable({ emitEvent: false });
  }

  /** New activity type typed into the combobox — persist it and reload the dropdown. */
  async onTypeAdded(name: string): Promise<void> {
    try {
      const created = await this.referenceDataService.createActivityType(name);
      this.referenceActivityTypes.update((list) =>
        list.some((t) => t.id === created.id) ? list : [...list, created],
      );
      this.form.patchValue({ type: created.name });
    } catch {
      this.toast.error('Could not save the new activity type.');
    }
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

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

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
      // Lifecycle progress is unlinked from activity completion for now (#167).
      // if (val.cropId) {
      //   this.cropService.syncStageFromActivity(this.activityId);
      // }
      this.toast.success('Activity updated.');
    } else {
      // Create activity
      let newAct: Activity;
      this.saving.set(true);
      try {
        newAct = await this.activityService.addActivity({
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
      } catch {
        this.toast.error('Could not save the activity. Please try again.');
        return;
      } finally {
        this.saving.set(false);
      }

      // Lifecycle progress is unlinked from activity completion for now (#167).
      // if (val.cropId) {
      //   this.cropService.syncStageFromActivity(newAct.id);
      // }

      this.toast.success(`${newAct.type === 'Custom' ? 'Activity' : newAct.type} logged.`);

      // Mark activity phase complete on first activity created
      const actCount = this.activityService.activities().filter((a) => a.status !== 'Draft').length;
      if (actCount === 1) {
        this.workflowService.markPhaseComplete('activity');
      }

      if (this.isCropScoped()) {
        this.router.navigate(['..'], { relativeTo: this.route });
      } else {
        this.router.navigate(['/activities', newAct.id]);
      }
      return;
    }

    if (this.isCropScoped()) {
      this.router.navigate(['..'], { relativeTo: this.route });
    } else {
      this.router.navigate(['/activities']);
    }
  }

  onCancel(): void {
    if (this.isCropScoped()) {
      this.router.navigate(['..'], { relativeTo: this.route });
    } else {
      this.router.navigate(['/activities']);
    }
  }
}
