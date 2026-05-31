import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CropEntity, ActivityEntity, CropStage, ActivityType, ActivityStatus } from '../crop-timeline.models';
import { LogActivityComponent } from '../log-activity/log-activity.component';

@Component({
  standalone: true,
  selector: 'app-crop-timeline-detail',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LogActivityComponent],
  templateUrl: './crop-timeline-detail.component.html',
  styleUrl: './crop-timeline-detail.component.scss'
})
export class CropTimelineDetailComponent {
  @Input({ required: true }) selectedCrop!: CropEntity | null;
  @Input({ required: true }) stages!: CropStage[];
  @Input({ required: true }) upcomingActivities!: ActivityEntity[];
  @Input({ required: true }) cropActivities!: ActivityEntity[];
  @Input({ required: true }) activityForm!: FormGroup;
  @Input({ required: true }) showActivityModal!: boolean;
  @Input({ required: true }) editingActivity!: ActivityEntity | null;
  @Input({ required: true }) uploadedImages!: string[];

  @Output() readonly backClicked = new EventEmitter<void>();
  @Output() readonly updateStageClicked = new EventEmitter<CropStage>();
  @Output() readonly addActivityClicked = new EventEmitter<void>();
  @Output() readonly editActivityClicked = new EventEmitter<ActivityEntity>();
  @Output() readonly deleteActivityClicked = new EventEmitter<string>();
  @Output() readonly markActivityCompletedClicked = new EventEmitter<string>();
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
  getDaysAfterSowing(sowingDateStr: string): number {
    const sowing = Date.parse(sowingDateStr);
    const diff = Date.now() - sowing;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  }

  getStageIndex(stage: CropStage): number {
    return this.stages.indexOf(stage);
  }

  getActivityIcon(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.icon : 'bi-calendar-event';
  }

  getActivityEmoji(type: ActivityType): string {
    switch (type) {
      case 'Sowing': return '🌱';
      case 'Irrigation': return '💧';
      case 'Fertilizer Application': return '🌿';
      case 'Spray Application': return '🐛';
      case 'Weeding': return '✂️';
      case 'Field Inspection': return '📷';
      case 'Labour Activity': return '👥';
      case 'Harvest': return '🌾';
      case 'Sale': return '💰';
      case 'Weather Incident': return '⚡';
      default: return '📅';
    }
  }

  getActivityColor(type: ActivityType): string {
    const item = this.activityTypes.find(a => a.type === type);
    return item ? item.color : '#4a5568';
  }
}
