import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CropStage, CROP_STAGES } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { FarmLookupService } from '../../../core/farms/farm-lookup.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService, WorkflowStateService } from 'shared';

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
  imports: [CommonModule, ReactiveFormsModule],
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
  readonly cropForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    cropType: ['Soybeans', Validators.required],
    fieldId: ['', [Validators.required, Validators.minLength(2)]],
    area: ['', [Validators.required, Validators.min(0.01)]],
    areaUnit: ['hectares', Validators.required],
    sowingDate: [''],
    currentStage: ['Land Preparation' as CropStage, Validators.required],
  });

  readonly stages = CROP_STAGES;
  readonly cropNameOptions = CROP_NAME_OPTIONS;

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

  onSubmit(): void {
    if (!this.cropForm.valid) return;

    const values = this.cropForm.getRawValue();
    const newCrop = this.cropService.addCrop({
      name: values.name,
      cropType: values.cropType,
      fieldId: values.fieldId,
      area: Number(values.area),
      areaUnit: values.areaUnit,
      sowingDate: values.sowingDate ? new Date(values.sowingDate).getTime() : undefined,
      currentStage: values.currentStage,
      status: 'Active',
    });

    this.workflowService.markPhaseComplete('crop');
    this.toast.success(`${newCrop.name} added with its growth-stage timeline.`);

    this.cropForm.reset({
      name: '',
      cropType: 'Soybeans',
      fieldId: '',
      area: '',
      areaUnit: 'hectares',
      sowingDate: '',
      currentStage: 'Land Preparation',
    });

    this.router.navigate(['/crops']);
  }
}
