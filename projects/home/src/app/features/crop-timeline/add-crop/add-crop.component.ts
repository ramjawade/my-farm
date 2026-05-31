import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CropTimelineComponent } from '../crop-timeline.component';
import { CropStage } from '../crop-timeline.models';

@Component({
  standalone: true,
  selector: 'app-add-crop',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-crop.component.html'
})
export class AddCropComponent implements OnInit {
  private readonly parent = inject(CropTimelineComponent, { optional: true });
  private readonly router = inject(Router, { optional: true });

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
      this.submitCrop.emit();
      if (this.router) {
        this.router.navigate(['/crops']);
      }
    }
  }
}
