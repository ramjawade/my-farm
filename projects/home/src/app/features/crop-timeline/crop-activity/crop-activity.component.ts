import {
  Component,
  inject,
  OnInit,
  computed,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CropTimelineService } from '../crop-timeline.service';
import { CropStage, CROP_STAGES } from '../crop-timeline.models';
import { stageIndex } from '../crop-timeline.utils';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { parseId } from '../../../core/models/entity-id';

@Component({
  standalone: true,
  selector: 'app-crop-activity',
  imports: [CommonModule, RouterOutlet, ConfirmDialogComponent],
  templateUrl: './crop-activity.component.html',
  styleUrl: './crop-activity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropActivityComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly timelineService = inject(CropTimelineService);
  private readonly toast = inject(ToastService);

  private readonly cropId = toSignal(
    this.route.paramMap.pipe(map((params) => parseId(params.get('cropId')))),
    { initialValue: null },
  );

  readonly crop = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.getCropById(id) : null;
  });

  readonly cropCost = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.costForCrop(id) : 0;
  });

  readonly showDeleteCropConfirm = signal(false);

  readonly stages = CROP_STAGES;

  ngOnInit(): void {
    void this.timelineService.reload();
  }

  onBackClicked(): void {
    this.router.navigate(['/crops']);
  }

  onAddActivityClicked(): void {
    this.router.navigate(['create'], { relativeTo: this.route });
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

  getDaysAfterSowing(sowingDate: number | undefined): number {
    if (!sowingDate) return 0;
    const diff = Date.now() - sowingDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  }

  getStageIndex(stage: CropStage): number {
    return stageIndex(stage);
  }
}
