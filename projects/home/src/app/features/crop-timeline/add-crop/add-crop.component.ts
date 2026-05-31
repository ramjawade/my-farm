import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CropStage } from '../crop-timeline.models';

@Component({
  standalone: true,
  selector: 'app-add-crop',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-crop.component.html'
})
export class AddCropComponent {
  @Input({ required: true }) cropForm!: FormGroup;
  @Input({ required: true }) cropNameOptions!: string[];
  @Input({ required: true }) stages!: CropStage[];

  @Output() readonly cancelClicked = new EventEmitter<void>();
  @Output() readonly submitCrop = new EventEmitter<void>();

  onSubmit(): void {
    if (this.cropForm.valid) {
      this.submitCrop.emit();
    }
  }
}
