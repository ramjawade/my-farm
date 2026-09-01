import { Component, Input, Output, EventEmitter, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CropTimelineService } from '../crop-timeline.service';
import { CropTimelineComponent } from '../crop-timeline.component';
import { CropEntity, ActivityEntity, CropStage, ActivityType } from '../crop-timeline.models';
import { CreateActivityComponent } from '../../farm-activity/create/create-activity.component';
import { FarmActivityService } from '../../farm-activity/farm-activity.service';
import { ActivitiesSummaryComponent } from '../../farm-activity/summary/activities-summary.component';

@Component({
  standalone: true,
  selector: 'app-crop-timeline-detail',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CreateActivityComponent, ActivitiesSummaryComponent],
  templateUrl: './crop-timeline-detail.component.html',
  styleUrl: './crop-timeline-detail.component.scss'
})
export class CropTimelineDetailComponent implements OnInit {
  private readonly parent = inject(CropTimelineComponent, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly timelineService = inject(CropTimelineService, { optional: true });
  private readonly farmActivityService = inject(FarmActivityService, { optional: true });

  readonly selectedCropInput = signal<CropEntity | null>(null);
  @Input() set selectedCrop(value: CropEntity | null) {
    this.selectedCropInput.set(value);
  }
  readonly selectedCropSignal = computed(() => {
    const inputVal = this.selectedCropInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.selectedCrop() : null;
  });
  get selectedCrop(): CropEntity | null {
    return this.selectedCropSignal();
  }

  readonly stagesInput = signal<CropStage[] | null>(null);
  @Input() set stages(value: CropStage[]) {
    this.stagesInput.set(value);
  }
  readonly stagesSignal = computed(() => {
    const inputVal = this.stagesInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.stages : [];
  });
  get stages(): CropStage[] {
    return this.stagesSignal();
  }

  readonly upcomingActivitiesInput = signal<ActivityEntity[] | null>(null);
  @Input() set upcomingActivities(value: ActivityEntity[]) {
    this.upcomingActivitiesInput.set(value);
  }
  readonly upcomingActivitiesSignal = computed(() => {
    const inputVal = this.upcomingActivitiesInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.upcomingActivities() : [];
  });
  get upcomingActivities(): ActivityEntity[] {
    return this.upcomingActivitiesSignal();
  }

  readonly cropActivitiesInput = signal<ActivityEntity[] | null>(null);
  @Input() set cropActivities(value: ActivityEntity[]) {
    this.cropActivitiesInput.set(value);
  }
  readonly cropActivitiesSignal = computed(() => {
    const inputVal = this.cropActivitiesInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.cropActivities() : [];
  });
  get cropActivities(): ActivityEntity[] {
    return this.cropActivitiesSignal();
  }

  private _activityForm!: FormGroup;
  @Input() set activityForm(value: FormGroup) {
    this._activityForm = value;
  }
  get activityForm(): FormGroup {
    return this._activityForm || this.parent?.activityForm;
  }

  readonly showActivityModalInput = signal<boolean | null>(null);
  @Input() set showActivityModal(value: boolean) {
    this.showActivityModalInput.set(value);
  }
  readonly showActivityModalSignal = computed(() => {
    const inputVal = this.showActivityModalInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.showActivityModal() : false;
  });
  get showActivityModal(): boolean {
    return this.showActivityModalSignal();
  }

  readonly editingActivityInput = signal<ActivityEntity | null>(null);
  @Input() set editingActivity(value: ActivityEntity | null) {
    this.editingActivityInput.set(value);
  }
  readonly editingActivitySignal = computed(() => {
    const inputVal = this.editingActivityInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.editingActivity() : null;
  });
  get editingActivity(): ActivityEntity | null {
    return this.editingActivitySignal();
  }

  readonly uploadedImagesInput = signal<string[] | null>(null);
  @Input() set uploadedImages(value: string[]) {
    this.uploadedImagesInput.set(value);
  }
  readonly uploadedImagesSignal = computed(() => {
    const inputVal = this.uploadedImagesInput();
    if (inputVal !== null) return inputVal;
    return this.parent ? this.parent.uploadedImages() : [];
  });
  get uploadedImages(): string[] {
    return this.uploadedImagesSignal();
  }

  @Output() readonly backClicked = new EventEmitter<void>();
  @Output() readonly updateStageClicked = new EventEmitter<CropStage>();
  @Output() readonly addActivityClicked = new EventEmitter<void>();
  @Output() readonly editActivityClicked = new EventEmitter<ActivityEntity>();
  @Output() readonly deleteActivityClicked = new EventEmitter<string>();
  @Output() readonly deleteCropClicked = new EventEmitter<string>();
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

  readonly parentActivityIdForModal = signal<string | null>(null);
  readonly editingActivityIdForModal = signal<string | null>(null);

  onUpdateStageClicked(stage: CropStage): void {
    this.updateStageClicked.emit(stage);
    const crop = this.selectedCrop;
    if (crop && this.timelineService) {
      let mainAct = this.timelineService.findMainActivityForStage(crop.id, stage);
      if (!mainAct) {
        mainAct = this.timelineService.findOrCreateMainActivityForStage(crop.id, stage);
      }
      this.parentActivityIdForModal.set(mainAct.id);
      this.editingActivityIdForModal.set(null);
      if (this.parent) {
        this.parent.showActivityModal.set(true);
      }
    }
  }

  onAddActivityClicked(): void {
    this.addActivityClicked.emit();
    this.parentActivityIdForModal.set(null);
    this.editingActivityIdForModal.set(null);
    if (this.parent) {
      this.parent.showActivityModal.set(true);
    }
  }

  onEditActivityClicked(act: ActivityEntity): void {
    this.editActivityClicked.emit(act);
    this.editingActivityIdForModal.set(act.id);
    this.parentActivityIdForModal.set(act.parentActivityId || null);
    if (this.parent) {
      this.parent.showActivityModal.set(true);
    }
  }

  onDeleteActivityClicked(id: string): void {
    this.deleteActivityClicked.emit(id);
    if (this.parent) {
      this.parent.onDeleteActivity(id);
    }
  }

  onDeleteCropClicked(): void {
    const crop = this.selectedCrop;
    if (crop) {
      this.deleteCropClicked.emit(crop.id);
      if (this.parent) {
        this.parent.onDeleteCrop(crop.id);
      }
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
    this.editingActivityIdForModal.set(null);
    this.parentActivityIdForModal.set(null);
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

  getDaysAfterSowing(sowingDate: number | undefined): number {
    if (!sowingDate) return 0;
    const diff = Date.now() - sowingDate;
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
