import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CropDashboardService } from './crop-dashboard.service';
import { ActivityService } from '../../activity/activity.service';
import { CropEntity, CropStage, CROP_STAGES } from '../crop-timeline.models';
import { stageIndex, stageProgressPercent } from '../crop-timeline.utils';

@Component({
  standalone: true,
  selector: 'app-crop-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './crop-dashboard.component.html',
  styleUrl: './crop-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropDashboardComponent implements OnInit {
  private readonly cropDashboardService = inject(CropDashboardService);
  private readonly activityService = inject(ActivityService);
  private readonly router = inject(Router);

  readonly searchTerm = signal<string>('');
  readonly crops = signal<CropEntity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly filteredCrops = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const allCrops = this.crops();
    if (!term) return allCrops;
    return allCrops.filter(
      (c) => c.name.toLowerCase().includes(term) || String(c.fieldId).includes(term),
    );
  });

  readonly stages = CROP_STAGES;

  /** True when there are zero crops on the account at all -- distinct from
   * a search term simply matching nothing, so the empty state can tell the
   * two apart instead of always blaming "your search". */
  readonly hasNoCropsAtAll = computed(() => this.crops().length === 0);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.crops.set(await this.cropDashboardService.getCrops());
    } catch {
      this.error.set('Could not load your crops. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
  }

  onCropSelected(crop: CropEntity): void {
    this.router.navigate(['/crops', crop.id]);
  }

  onAddCropClicked(): void {
    this.router.navigate(['/crops/add']);
  }

  getDaysAfterSowing(sowingDate: number | undefined): number {
    if (!sowingDate) return 0;
    const diff = Date.now() - sowingDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  }

  getDaysSinceLastActivity(cropId: number): string {
    const cropActs = this.activityService
      .activities()
      .filter((a) => a.cropId === cropId && a.status === 'Completed' && !a.parentActivityId)
      .sort((a, b) => (b.date || 0) - (a.date || 0));

    if (cropActs.length === 0) {
      return 'No activity logged';
    }

    const lastDate = cropActs[0].date;
    if (!lastDate) return 'No activity logged';
    const diff = Date.now() - lastDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'Today';
    if (days === 0) return 'Today';
    if (days === 1) return '1 Day';
    return `${days} Days`;
  }

  getNextStage(currentStage: CropStage): string {
    const idx = stageIndex(currentStage);
    if (idx === -1 || idx === this.stages.length - 1) {
      return 'Fully Mature';
    }
    return this.stages[idx + 1];
  }

  getStageIndex(stage: CropStage): number {
    return stageIndex(stage);
  }

  getStagePercent(stage: CropStage): number {
    return stageProgressPercent(stage);
  }
}
