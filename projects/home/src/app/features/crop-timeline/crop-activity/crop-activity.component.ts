import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs/operators';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { FarmLookupService } from '../../../core/farms/farm-lookup.service';
import { LocalDatePipe, LocalNumberPipe } from '../../../core/i18n/localized.pipes';
import { I18n } from '../../../core/i18n/i18n.service';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { parseId } from '../../../core/models/entity-id';
import { SavedFarm } from '../../../map/models/map.models';
import { CropActivity } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { cropIconClass, daysAfterSowing, stageStep, STAGE_STEPS } from '../crop-timeline.utils';
import { StageBarComponent } from '../stage-bar/stage-bar.component';

export type ActivityTab = 'all' | 'upcoming' | 'recent';

@Component({
  selector: 'app-crop-activity',
  imports: [
    LocalDatePipe,
    LocalNumberPipe,
    RouterLink,
    RouterOutlet,
    ConfirmDialogComponent,
    StageBarComponent,
    TranslatePipe,
    ReferenceNamePipe,
  ],
  templateUrl: './crop-activity.component.html',
  styleUrl: './crop-activity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropActivityComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly timelineService = inject(CropTimelineService);
  private readonly farmLookup = inject(FarmLookupService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18n);

  private readonly cropId = toSignal(
    this.route.paramMap.pipe(map((params) => parseId(params.get('cropId')))),
    { initialValue: null },
  );

  /** True while a child page (log activity, all activities) is open, so it shows instead of the detail. */
  readonly hasChild = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => !!this.route.firstChild),
      startWith(!!this.route.firstChild),
    ),
    { initialValue: false },
  );

  readonly crop = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.getCropById(id) : null;
  });

  readonly cropCost = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.costForCrop(id) : 0;
  });

  readonly lands = signal<SavedFarm[]>([]);
  readonly land = computed(() => this.lands().find((l) => l.id === this.crop()?.fieldId) ?? null);

  readonly showDeleteCropConfirm = signal(false);
  readonly tab = signal<ActivityTab>('all');

  readonly iconClass = computed(() => cropIconClass(this.crop()?.name ?? ''));
  readonly age = computed(() => daysAfterSowing(this.crop()?.sowingDate));

  /** The stored stage's displayed step name (one of four). */
  readonly stageName = computed(() => {
    const crop = this.crop();
    return crop ? this.i18n.t(STAGE_STEPS[stageStep(crop.currentStage)]) : '';
  });

  /** Irrigation and method in the active language; each is only shown when set. */
  readonly irrigationLabel = computed(() =>
    this.optionLabel('irrigation', this.crop()?.irrigationType),
  );
  readonly methodLabel = computed(() => this.optionLabel('method', this.crop()?.farmingMethod));

  private readonly activities = computed(() => {
    const id = this.cropId();
    return id ? this.timelineService.getActivitiesForCrop(id) : [];
  });

  private readonly sorted = (list: CropActivity[]) =>
    [...list].sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity));

  readonly done = computed(() => this.activities().filter((a) => a.status === 'Completed'));
  readonly planned = computed(() =>
    this.sorted(
      this.activities().filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled'),
    ),
  );
  readonly recent = computed(() =>
    [...this.done()].sort((a, b) => (b.date ?? 0) - (a.date ?? 0)).slice(0, 5),
  );

  readonly tabs = computed(() => [
    { key: 'all' as const, count: this.done().length + this.planned().length },
    { key: 'upcoming' as const, count: this.planned().length },
    { key: 'recent' as const, count: this.recent().length },
  ]);

  readonly visibleActivities = computed(() => {
    switch (this.tab()) {
      case 'upcoming':
        return this.planned();
      case 'recent':
        return this.recent();
      default:
        return [...this.planned(), ...this.done()];
    }
  });

  /** Oldest first: what was done, then what is planned. */
  readonly timeline = computed(() => this.sorted([...this.done(), ...this.planned()]));

  readonly canAdvance = computed(() => {
    const crop = this.crop();
    return !!crop && this.timelineService.getNextStage(crop.currentStage) !== null;
  });

  async ngOnInit(): Promise<void> {
    void this.timelineService.reload();
    try {
      this.lands.set(await this.farmLookup.loadForCurrentUser());
    } catch {
      // The header simply omits the land link if lands cannot be loaded.
    }
  }

  onBackClicked(): void {
    this.router.navigate(['/crops']);
  }

  onAddActivityClicked(): void {
    this.router.navigate(['create'], { relativeTo: this.route });
  }

  onEditClicked(): void {
    this.router.navigate(['/crops', this.cropId(), 'edit']);
  }

  advance(): void {
    const id = this.cropId();
    if (id) this.timelineService.advanceStage(id);
  }

  onDeleteCropClicked(): void {
    this.showDeleteCropConfirm.set(true);
  }

  confirmDeleteCrop(): void {
    const c = this.crop();
    if (c) {
      this.timelineService.deleteCrop(c.id);
      this.toast.success(this.translate.instant('cropActivity.deletedToast'));
      this.showDeleteCropConfirm.set(false);
      this.router.navigate(['/crops']);
    }
  }

  private optionLabel(kind: 'irrigation' | 'method', value: string | undefined): string {
    if (!value) return '';
    const key = `cropOptions.${kind}.${value.replace(/\s+/g, '')}`;
    const label = this.i18n.t(key);
    return label === key ? value : label;
  }
}
