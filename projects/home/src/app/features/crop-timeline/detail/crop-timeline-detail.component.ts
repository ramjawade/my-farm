import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity, CropActivity, CropStage, CROP_STAGES } from '../crop-timeline.models';
import { CreateActivityComponent } from '../../farm-activity/create/create-activity.component';
import { ActivitiesSummaryComponent } from '../../farm-activity/summary/activities-summary.component';
import { ConfirmDialogComponent, ToastService } from 'shared';

@Component({
  standalone: true,
  selector: 'app-crop-timeline-detail',
  imports: [
    CommonModule,
    FormsModule,
    CreateActivityComponent,
    ActivitiesSummaryComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './crop-timeline-detail.component.html',
  styleUrl: './crop-timeline-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropTimelineDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly timelineService = inject(CropTimelineService);
  private readonly toast = inject(ToastService);

  // Read crop ID from route params
  private readonly cropId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') || '')),
    { initialValue: '' },
  );

  // Get crop from service by ID
  readonly crop = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.getCropById(id) : null;
  });

  // Activities for this crop
  readonly activities = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.getActivitiesForCrop(id) : [];
  });

  // Cost for this crop
  readonly cropCost = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.costForCrop(id) : 0;
  });

  // Next stage
  readonly nextStage = computed(() => {
    const c = this.crop();
    return c ? this.timelineService.getNextStage(c.currentStage) : null;
  });

  readonly canAdvanceStage = computed(() => this.nextStage() !== null);

  // Modal state
  readonly showActivityModal = signal(false);
  readonly parentActivityIdForModal = signal<string | null>(null);
  readonly editingActivityIdForModal = signal<string | null>(null);
  readonly showDeleteCropConfirm = signal(false);

  readonly stages = CROP_STAGES;

  ngOnInit(): void {
    void this.timelineService.reload();
  }

  onBackClicked(): void {
    this.router.navigate(['/crops']);
  }

  onUpdateStageClicked(stage: CropStage): void {
    const c = this.crop();
    if (!c) return;
    let mainAct = this.timelineService.findMainActivityForStage(c.id, stage);
    if (!mainAct) {
      mainAct = this.timelineService.ensureScheduledActivityForStage(c.id, stage);
    }
    this.parentActivityIdForModal.set(mainAct.id);
    this.editingActivityIdForModal.set(null);
    this.showActivityModal.set(true);
  }

  onAddActivityClicked(): void {
    this.parentActivityIdForModal.set(null);
    this.editingActivityIdForModal.set(null);
    this.showActivityModal.set(true);
  }

  onEditActivityClicked(act: CropActivity): void {
    this.editingActivityIdForModal.set(act.id);
    this.parentActivityIdForModal.set(act.parentActivityId || null);
    this.showActivityModal.set(true);
  }

  onDeleteActivityClicked(id: string): void {
    this.timelineService.deleteActivity(id);
    this.toast.success('Activity deleted.');
  }

  onDeleteCropClicked(): void {
    this.showDeleteCropConfirm.set(true);
  }

  confirmDeleteCrop(): void {
    const c = this.crop();
    if (c) {
      this.timelineService.deleteCrop(c.id);
      this.toast.success('Crop and its activities deleted.');
      this.showDeleteCropConfirm.set(false);
      this.router.navigate(['/crops']);
    }
  }

  onMarkActivityCompletedClicked(id: string): void {
    this.timelineService.completeActivity(id);
  }

  onCloseActivityModal(): void {
    this.editingActivityIdForModal.set(null);
    this.parentActivityIdForModal.set(null);
    this.showActivityModal.set(false);
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
}
