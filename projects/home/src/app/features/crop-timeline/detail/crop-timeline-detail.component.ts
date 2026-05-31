import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CropTimelineService } from '../crop-timeline.service';
import { CropTimelineComponent } from '../crop-timeline.component';
import { CropEntity, ActivityEntity, CropStage, ActivityType } from '../crop-timeline.models';
import { LogActivityComponent } from '../log-activity/log-activity.component';

@Component({
  standalone: true,
  selector: 'app-crop-timeline-detail',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LogActivityComponent],
  templateUrl: './crop-timeline-detail.component.html',
  styleUrl: './crop-timeline-detail.component.scss'
})
export class CropTimelineDetailComponent implements OnInit {
  private readonly parent = inject(CropTimelineComponent, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly timelineService = inject(CropTimelineService, { optional: true });

  private _selectedCrop: CropEntity | null = null;
  @Input() set selectedCrop(value: CropEntity | null) {
    this._selectedCrop = value;
  }
  get selectedCrop(): CropEntity | null {
    return this._selectedCrop !== undefined ? this._selectedCrop : this.parent?.selectedCrop() || null;
  }

  private _stages!: CropStage[];
  @Input() set stages(value: CropStage[]) {
    this._stages = value;
  }
  get stages(): CropStage[] {
    return this._stages || this.parent?.stages || [];
  }

  private _upcomingActivities!: ActivityEntity[];
  @Input() set upcomingActivities(value: ActivityEntity[]) {
    this._upcomingActivities = value;
  }
  get upcomingActivities(): ActivityEntity[] {
    return this._upcomingActivities || this.parent?.upcomingActivities() || [];
  }

  private _cropActivities!: ActivityEntity[];
  @Input() set cropActivities(value: ActivityEntity[]) {
    this._cropActivities = value;
  }
  get cropActivities(): ActivityEntity[] {
    return this._cropActivities || this.parent?.cropActivities() || [];
  }

  private _activityForm!: FormGroup;
  @Input() set activityForm(value: FormGroup) {
    this._activityForm = value;
  }
  get activityForm(): FormGroup {
    return this._activityForm || this.parent?.activityForm;
  }

  private _showActivityModal!: boolean;
  @Input() set showActivityModal(value: boolean) {
    this._showActivityModal = value;
  }
  get showActivityModal(): boolean {
    return this._showActivityModal !== undefined ? this._showActivityModal : this.parent?.showActivityModal() || false;
  }

  private _editingActivity: ActivityEntity | null = null;
  @Input() set editingActivity(value: ActivityEntity | null) {
    this._editingActivity = value;
  }
  get editingActivity(): ActivityEntity | null {
    return this._editingActivity !== undefined ? this._editingActivity : this.parent?.editingActivity() || null;
  }

  private _uploadedImages!: string[];
  @Input() set uploadedImages(value: string[]) {
    this._uploadedImages = value;
  }
  get uploadedImages(): string[] {
    return this._uploadedImages || this.parent?.uploadedImages() || [];
  }

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

  ngOnInit(): void {
    const parentComp = this.parent;
    const timelineSvc = this.timelineService;
    if (this.route && parentComp && timelineSvc) {
      this.route.paramMap.subscribe(params => {
        const id = params.get('id');
        if (id) {
          const cropsList = timelineSvc.crops();
          const crop = cropsList.find(c => c.id === id);
          if (crop) {
            parentComp.selectedCrop.set(crop);
            parentComp.currentView.set('timeline');
          }
        }
      });
    }
  }

  onBackClicked(): void {
    this.backClicked.emit();
    if (this.parent) {
      this.parent.selectedCrop.set(null);
      this.parent.currentView.set('dashboard');
    }
    if (this.router) {
      this.router.navigate(['/crops']);
    }
  }

  onUpdateStageClicked(stage: CropStage): void {
    this.updateStageClicked.emit(stage);
    if (this.parent) {
      this.parent.updateStage(stage);
    }
  }

  onAddActivityClicked(): void {
    this.addActivityClicked.emit();
    if (this.parent) {
      this.parent.openAddActivityModal();
    }
  }

  onEditActivityClicked(act: ActivityEntity): void {
    this.editActivityClicked.emit(act);
    if (this.parent) {
      this.parent.openEditActivityModal(act);
    }
  }

  onDeleteActivityClicked(id: string): void {
    this.deleteActivityClicked.emit(id);
    if (this.parent) {
      this.parent.onDeleteActivity(id);
    }
  }

  onMarkActivityCompletedClicked(id: string): void {
    this.markActivityCompletedClicked.emit(id);
    if (this.parent) {
      this.parent.markActivityCompleted(id);
    }
  }

  onSubmitActivity(): void {
    this.submitActivity.emit();
    if (this.parent) {
      this.parent.onSubmitActivity();
    }
  }

  onCloseActivityModal(): void {
    this.closeActivityModal.emit();
    if (this.parent) {
      this.parent.showActivityModal.set(false);
    }
  }

  onImageSelected(event: Event): void {
    this.imageSelected.emit(event);
    if (this.parent) {
      this.parent.onImageSelected(event);
    }
  }

  onRemoveImage(index: number): void {
    this.removeImage.emit(index);
    if (this.parent) {
      this.parent.removeImage(index);
    }
  }

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
