import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CropDashboardService } from './crop-dashboard.service';
import { ActivityService } from '../../activity/activity.service';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { CropEntity } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { cropIconClass, daysAfterSowing } from '../crop-timeline.utils';
import { StageBarComponent } from '../stage-bar/stage-bar.component';
import { LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';

@Component({
  standalone: true,
  selector: 'app-crop-dashboard',
  imports: [
    FormsModule,
    ConfirmDialogComponent,
    LocalNumberPipe,
    StageBarComponent,
    TranslatePipe,
    ReferenceNamePipe,
  ],
  host: { '(document:keydown.escape)': 'menuId.set(null)' },
  templateUrl: './crop-dashboard.component.html',
  styleUrl: './crop-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropDashboardComponent implements OnInit {
  private readonly cropDashboardService = inject(CropDashboardService);
  private readonly activityService = inject(ActivityService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);
  private readonly farmDraw = inject(FarmDrawService);
  private readonly timeline = inject(CropTimelineService);
  private readonly toast = inject(ToastService);

  readonly menuId = signal<number | null>(null);
  readonly pendingDelete = signal<CropEntity | null>(null);
  readonly showDeleteConfirm = signal(false);

  readonly searchTerm = signal<string>('');
  readonly crops = signal<CropEntity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Land names by land id, so a crop card can say where it is planted instead of showing an id. */
  private readonly landNames = signal<ReadonlyMap<number, string>>(new Map());

  /** The land's name, or '' when it is unknown (e.g. the land was removed). */
  landName(fieldId: number): string {
    return this.landNames().get(fieldId) ?? '';
  }

  readonly filteredCrops = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const allCrops = this.crops();
    if (!term) return allCrops;
    return allCrops.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        this.landName(c.fieldId).toLowerCase().includes(term),
    );
  });

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
      this.error.set(this.translate.instant('cropDashboard.loadError'));
    } finally {
      this.loading.set(false);
    }
    void this.loadLandNames();
  }

  private async loadLandNames(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;
    try {
      const farms = await this.farmDraw.loadFarms(user.id);
      this.landNames.set(new Map(farms.map((farm) => [farm.id, farm.name])));
    } catch {
      // Cards simply omit the land badge if the names cannot be loaded.
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

  onBackClicked(): void {
    this.router.navigate(['/']);
  }

  getDaysAfterSowing(sowingDate: number | undefined): number {
    return daysAfterSowing(sowingDate) ?? 0;
  }

  /** Days since sowing, or null when the crop has no sowing date. */
  age(crop: CropEntity): number | null {
    return daysAfterSowing(crop.sowingDate);
  }

  iconClass(crop: CropEntity): string {
    return cropIconClass(crop.name);
  }

  /** Activities logged or planned for a crop (sub-activities are not counted). */
  activityCount(cropId: number): number {
    return this.activityService
      .activities()
      .filter((a) => a.cropId === cropId && !a.parentActivityId).length;
  }

  toggleMenu(cropId: number): void {
    this.menuId.update((open) => (open === cropId ? null : cropId));
  }

  onEditCrop(crop: CropEntity): void {
    this.menuId.set(null);
    this.router.navigate(['/crops', crop.id, 'edit']);
  }

  onDeleteCrop(crop: CropEntity): void {
    this.menuId.set(null);
    this.pendingDelete.set(crop);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const crop = this.pendingDelete();
    if (!crop) return;
    this.timeline.deleteCrop(crop.id);
    this.crops.update((list) => list.filter((c) => c.id !== crop.id));
    this.pendingDelete.set(null);
    this.toast.success(this.translate.instant('cropActivity.deletedToast'));
  }
}
