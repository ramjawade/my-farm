import { Component, Input, Output, EventEmitter, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CropTimelineComponent } from '../crop-timeline.component';
import { CropStage } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';

@Component({
  standalone: true,
  selector: 'app-add-crop',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-crop.component.html'
})
export class AddCropComponent implements OnInit {
  private readonly parent = inject(CropTimelineComponent, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);

  readonly savedFarms = this.farmDrawService.savedFarms;

  constructor() {
    effect(() => {
      const fields = this.savedFarms();
      const cropNames = this.cropNameOptions;
      const stagesList = this.stages;
      const form = this.cropForm;
      
      if (form) {
        // Auto-select crop type if only one option exists
        if (cropNames.length === 1) {
          form.patchValue({ cropType: cropNames[0] });
        }

        // Auto-select fieldId (land) if only one option exists
        if (fields.length === 1) {
          form.patchValue({ fieldId: fields[0].id });
        }

        // Auto-select currentStage if only one option exists
        if (stagesList.length === 1) {
          form.patchValue({ currentStage: stagesList[0] });
        }
      }
    }, { allowSignalWrites: true });
  }

  private _cropForm!: FormGroup;
  @Input() set cropForm(value: FormGroup) {
    this._cropForm = value;
  }
  get cropForm(): FormGroup {
    return this._cropForm || this.parent?.cropForm;
  }

  private _cropNameOptions!: string[];
  @Input() set cropNameOptions(value: string[]) {
    this._cropNameOptions = value;
  }
  get cropNameOptions(): string[] {
    return this._cropNameOptions || this.parent?.cropNameOptions || [];
  }

  private _stages!: CropStage[];
  @Input() set stages(value: CropStage[]) {
    this._stages = value;
  }
  get stages(): CropStage[] {
    return this._stages || this.parent?.stages || [];
  }

  @Output() readonly cancelClicked = new EventEmitter<void>();
  @Output() readonly submitCrop = new EventEmitter<void>();

  ngOnInit(): void {
    if (this.parent) {
      this.parent.selectedCrop.set(null);
      this.parent.currentView.set('add-crop');
    }
  }

  onCancel(): void {
    this.cancelClicked.emit();
    if (this.router) {
      this.router.navigate(['/crops']);
    }
  }

  onSubmit(): void {
    if (this.cropForm.valid) {
      const values = this.cropForm.value;
      const newCrop = this.cropService.addCrop({
        name: values.name,
        cropType: values.cropType,
        fieldId: values.fieldId,
        area: Number(values.area),
        areaUnit: values.areaUnit,
        sowingDate: values.sowingDate ? new Date(values.sowingDate).getTime() : undefined,
        currentStage: values.currentStage as CropStage,
        status: 'Active'
      });

      this.submitCrop.emit();

      this.cropForm.reset({
        name: '',
        cropType: 'Soybeans',
        fieldId: '',
        area: '',
        areaUnit: 'hectares',
        sowingDate: '',
        currentStage: 'Land Preparation'
      });

      if (this.router) {
        this.router.navigate(['/crops']);
      }
    }
  }
}
