import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivityEntity, ActivityType, ActivityStatus } from '../crop-timeline.models';

@Component({
  standalone: true,
  selector: 'app-log-activity',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './log-activity.component.html',
  styleUrl: './log-activity.component.scss'
})
export class LogActivityComponent {
  @Input({ required: true }) activityForm!: FormGroup;
  @Input({ required: true }) showActivityModal!: boolean;
  @Input({ required: true }) editingActivity!: ActivityEntity | null;
  @Input({ required: true }) uploadedImages!: string[];

  @Output() readonly submitActivity = new EventEmitter<void>();
  @Output() readonly closeActivityModal = new EventEmitter<void>();
  @Output() readonly imageSelected = new EventEmitter<Event>();
  @Output() readonly removeImage = new EventEmitter<number>();

  readonly activityTypes: { type: ActivityType; icon: string; color: string }[] = [
    { type: 'Sowing', icon: 'bi-seedling', color: '#38a169' },
    { type: 'Irrigation', icon: 'bi-droplet-half', color: '#3182ce' },
    { type: 'Fertilizer Application', icon: 'bi-box-seam', color: '#805ad5' },
    { type: 'Spray Application', icon: 'bi-wind', color: '#e53e3e' },
    { type: 'Weeding', icon: 'bi-scissors', color: '#dd6b20' },
    { type: 'Field Inspection', icon: 'bi-eye-fill', color: '#319795' },
    { type: 'Labour Activity', icon: 'bi-people-fill', color: '#4a5568' },
    { type: 'Harvest', icon: 'bi-flower3', color: '#d69e2e' },
    { type: 'Sale', icon: 'bi-cash-coin', color: '#38a169' },
    { type: 'Weather Incident', icon: 'bi-lightning-charge-fill', color: '#e53e3e' }
  ];

  readonly activityStatuses: ActivityStatus[] = ['Planned', 'Scheduled', 'Completed', 'Cancelled'];

  onImageSelected(event: Event): void {
    this.imageSelected.emit(event);
  }

  onRemoveImage(index: number): void {
    this.removeImage.emit(index);
  }

  onSubmit(): void {
    if (this.activityForm.valid) {
      this.submitActivity.emit();
    }
  }
}
