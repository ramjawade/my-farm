import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CROP_STAGES } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { FarmLookupService } from '../../../core/farms/farm-lookup.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { ToastService, ComboboxComponent } from 'shared';
import { SEASONS, seasonForDate } from '../../../core/models/season';

const CROP_NAME_OPTIONS = [
  'Soybeans',
  'Wheat',
  'Rice',
  'Corn',
  'Cotton',
  'Sugarcane',
  'Mustard',
  'Vegetables',
  'Fruits',
];

@Component({
  standalone: true,
  selector: 'app-add-crop',
  imports: [CommonModule, ReactiveFormsModule, ComboboxComponent],
  templateUrl: './add-crop.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCropComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmLookup = inject(FarmLookupService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly workflowService = inject(WorkflowStateService);

  readonly savedFarms = signal<SavedFarm[]>([]);
  readonly creatingName = signal(false);

  readonly cropForm = this.fb.nonNullable.group({
    season: [seasonForDate(), Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    fieldId: ['', [Validators.required, Validators.minLength(2)]],
    area: ['', [Validators.required, Validators.min(0.01)]],
    areaUnit: ['hectares', Validators.required],
    sowingDate: [''],
  });

  readonly seasons = SEASONS;
  readonly cropNames = computed(() => {
    const crops = this.cropService.crops();
    const names = crops.map((c) => c.name);
    return [...new Set(names)].sort();
  });

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      this.savedFarms.set(await this.farmLookup.loadForCurrentUser());
      // Auto-select field if only one farm exists
      if (this.savedFarms().length === 1) {
        this.cropForm.patchValue({ fieldId: this.savedFarms()[0].id });
      }
    }
  }

  onCancel(): void {
    this.router.navigate(['/crops']);
  }

  onNameAdded(newName: string): void {
    this.creatingName.set(true);
    this.cropForm.patchValue({ name: newName });
    this.creatingName.set(false);
  }

  onSubmit(): void {
    if (!this.cropForm.valid || this.creatingName()) return;

    const values = this.cropForm.getRawValue();
    const newCrop = this.cropService.addCrop({
      name: values.name,
      cropType: values.name,
      fieldId: values.fieldId,
      area: Number(values.area),
      areaUnit: values.areaUnit as 'acres' | 'hectares',
      season: values.season,
      sowingDate: values.sowingDate ? new Date(values.sowingDate).getTime() : undefined,
      currentStage: CROP_STAGES[0],
      status: 'Active',
    });

    this.workflowService.markPhaseComplete('crop');
    this.toast.success(`${newCrop.name} added with its growth-stage timeline.`);

    this.cropForm.reset({
      season: seasonForDate(),
      name: '',
      fieldId: '',
      area: '',
      areaUnit: 'hectares',
      sowingDate: '',
    });

    this.router.navigate(['/crops']);
  }
}
