import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { DatePipe, CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivityService } from '../../activity/activity.service';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';
import { ActivityListFilters, ActivityListService } from './activity-list.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Activity, ActivityType } from '../../activity/activity.models';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { activityTypeEmoji } from '../../activity/activity-display';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { ReferenceItem } from '../../../core/api/contracts';
import { parseId } from '../../../core/models/entity-id';

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    CommonModule,
    ConfirmDialogComponent,
    TranslatePipe,
    ReferenceNamePipe,
  ],
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent implements OnInit {
  readonly activityService = inject(ActivityService);
  private readonly activityListService = inject(ActivityListService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly referenceDataService = inject(ReferenceDataService);

  private readonly cropIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => parseId(params.get('cropId')))),
    { initialValue: null },
  );

  readonly savedFarms = signal<SavedFarm[]>([]);
  readonly referenceActivityTypes = signal<ReferenceItem[]>([]);

  // Server-backed list, loaded a page at a time via ActivityListService.loadPage() — not the
  // shared ActivityService.activities() signal cache. Holds only the pages loaded so far.
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Paging: `cursor` is where the next page starts; `hasMore` mirrors the API's has_more.
  readonly cursor = signal<string | null>(null);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly loadMoreError = signal(false);
  /** Text for the polite live region, announced after rows are appended. */
  readonly liveMessage = signal('');

  // Bumped on every reload/loadMore so a response that arrives after a newer request is dropped.
  private requestToken = 0;

  readonly showDeleteConfirm = signal(false);
  readonly selectedActivityId = signal<number | null>(null);
  readonly viewMode = signal<'grid' | 'list'>('grid');

  // Server-driven filters — changing these triggers reload().
  readonly statusFilter = signal<string>('All');
  readonly sortBy = signal<string>('latest');

  // Manual "Linked Crop" dropdown — server-driven like status/sort, but not
  // URL-synced. Hidden when the route already supplies a `cropId` (see html).
  readonly cropFilter = signal<string>('All');

  // Season/field/type are server-driven too — each change refetches page 1 for the whole history.
  readonly seasonFilter = signal<string>('All');
  readonly fieldFilter = signal<string>('All');
  readonly typeFilter = signal<string>('All');

  readonly isCropScoped = computed(() => this.cropIdParam() !== null);

  // Keep "Back"/"Record New Activity" scoped to the crop when the list is
  // rendered under /crops/:cropId/list, instead of always dropping to the
  // farm-wide routes and losing the crop/field context.
  readonly backLink = computed<(string | number)[]>(() => {
    const cropId = this.cropIdParam();
    return cropId !== null ? ['/crops', cropId] : ['/activities'];
  });
  readonly createLink = computed<(string | number)[]>(() => {
    const cropId = this.cropIdParam();
    return cropId !== null ? ['/crops', cropId, 'create'] : ['/activities/create'];
  });

  readonly hasActiveFilters = computed(() => {
    return (
      this.seasonFilter() !== 'All' ||
      this.cropFilter() !== 'All' ||
      this.fieldFilter() !== 'All' ||
      this.typeFilter() !== 'All' ||
      this.statusFilter() !== 'All' ||
      this.sortBy() !== 'latest'
    );
  });

  // Fetch dropdown lists dynamically
  readonly cropsList = computed(() => this.cropService.crops());

  // Fields list can combine drawn farms and unique field IDs from loaded activities
  readonly fieldsList = computed(() => {
    const saved = this.savedFarms().map((f) => ({ id: f.id, name: f.name }));
    const activeFieldNames = this.activities()
      .map((a) => a.fieldId)
      .filter((fid): fid is number => !!fid && !saved.some((f) => f.id === fid));

    const uniqueActiveFields = Array.from(new Set(activeFieldNames)).map((id) => ({
      id,
      name: String(id),
    }));
    return [...saved, ...uniqueActiveFields];
  });

  readonly cropFilterName = computed(() => this.getCropName(Number(this.cropFilter())));
  readonly fieldFilterName = computed(() => this.getFieldName(Number(this.fieldFilter())));

  // Activity type names come from the reference data (the server filters by type id).
  readonly activityTypesList = computed(() => this.referenceActivityTypes().map((t) => t.name));

  async ngOnInit(): Promise<void> {
    // 1. Read filter inputs first: route params, then query params.
    let first = true;
    this.route.queryParams.subscribe((params) => {
      const status = params['status'] || 'All';
      const sort = params['sort'] || 'latest';
      const changed = status !== this.statusFilter() || sort !== this.sortBy();
      this.statusFilter.set(status);
      this.sortBy.set(sort);
      // Only refetch when status/sort actually changed (and always for the first emission).
      if (first || changed) void this.reload();
      first = false;
    });

    const user = this.authService.currentUser();
    if (user) {
      this.savedFarms.set(await this.farmDrawService.loadFarms(user.id));
    }

    try {
      const types = await this.referenceDataService.listActivityTypes();
      this.referenceActivityTypes.set(types);
    } catch (error) {
      console.error('Failed to load activity types:', error);
    }
  }

  /** The server-side filters currently selected on the page. */
  private currentFilters(): ActivityListFilters {
    const manualCropId = this.cropFilter() !== 'All' ? Number(this.cropFilter()) : undefined;
    const type = this.typeFilter();
    const field = this.fieldFilter();
    return {
      status: this.statusFilter(),
      sort: this.sortBy(),
      cropId: this.cropIdParam() ?? manualCropId,
      season: this.seasonFilter() !== 'All' ? this.seasonFilter() : undefined,
      landId: field !== 'All' ? Number(field) : undefined,
      activityTypeId:
        type !== 'All' ? this.referenceActivityTypes().find((t) => t.name === type)?.id : undefined,
    };
  }

  // 2. Once filters are known, load the first page of the activities that match them.
  async reload(): Promise<void> {
    const token = ++this.requestToken;
    this.loading.set(true);
    this.error.set(null);
    this.loadMoreError.set(false);
    this.loadingMore.set(false);
    this.liveMessage.set('');
    try {
      const page = await this.activityListService.loadPage(this.currentFilters());
      if (token !== this.requestToken) return; // a newer filter/sort change superseded this one
      this.activities.set(page.items);
      this.cursor.set(page.cursor);
      this.hasMore.set(page.hasMore);
    } catch {
      if (token !== this.requestToken) return;
      this.error.set(this.translate.instant('activityList.loadError'));
    } finally {
      if (token === this.requestToken) this.loading.set(false);
    }
  }

  /** Appends the next page for the current filters; on failure the loaded rows stay. */
  async loadMore(): Promise<void> {
    const cursor = this.cursor();
    if (!this.hasMore() || !cursor || this.loadingMore() || this.loading()) return;
    const token = this.requestToken;
    this.loadingMore.set(true);
    this.loadMoreError.set(false);
    try {
      const page = await this.activityListService.loadPage(this.currentFilters(), cursor);
      if (token !== this.requestToken) return;
      const known = new Set(this.activities().map((a) => a.id));
      const fresh = page.items.filter((a) => !known.has(a.id));
      this.activities.update((rows) => [...rows, ...fresh]);
      this.cursor.set(page.cursor);
      this.hasMore.set(page.hasMore);
      this.liveMessage.set(
        this.translate.instant(
          page.hasMore ? 'activityList.moreLoaded' : 'activityList.allLoaded',
          { count: fresh.length },
        ),
      );
    } catch {
      if (token === this.requestToken) this.loadMoreError.set(true);
    } finally {
      if (token === this.requestToken) this.loadingMore.set(false);
    }
  }

  getActivityTotalCost(activityId: number): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }

  getCropName(cropId?: number): string {
    if (!cropId) return '';
    const crop = this.cropsList().find((c) => c.id === cropId);
    return crop ? crop.name : this.translate.instant('activityList.unknownCrop');
  }

  getFieldName(fieldId?: number): string {
    if (!fieldId) return '';
    const farm = this.fieldsList().find((f) => f.id === fieldId);
    return farm ? farm.name : String(fieldId);
  }

  // Server-driven — each change refetches the first page for the whole history.
  setSeason(val: string): void {
    this.seasonFilter.set(val);
    void this.reload();
  }
  setField(val: string): void {
    this.fieldFilter.set(val);
    void this.reload();
  }
  setType(val: string): void {
    this.typeFilter.set(val);
    void this.reload();
  }

  // Server-driven — re-fetches with the new crop scope.
  setCrop(val: string): void {
    this.cropFilter.set(val);
    void this.reload();
  }

  // URL-synced filter setters — they re-sync the URL, which refetches via the queryParams
  // subscription above.
  setStatus(val: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { status: val },
    });
  }
  setSort(val: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { sort: val },
    });
  }

  clearFilters(): void {
    this.seasonFilter.set('All');
    this.cropFilter.set('All');
    this.fieldFilter.set('All');
    this.typeFilter.set('All');

    // A status/sort change also re-emits queryParams (which refetches); otherwise refetch here
    // so the cleared season/crop/field/type take effect.
    const paramsChange = this.statusFilter() !== 'All' || this.sortBy() !== 'latest';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
    if (!paramsChange) void this.reload();
  }

  typeName(activityTypeId: number): string {
    return this.referenceDataService.activityTypeName(activityTypeId);
  }

  getActivityEmoji(activityTypeId: number): string {
    return activityTypeEmoji(this.typeName(activityTypeId) as ActivityType);
  }

  onDeleteActivityClick(id: number, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectedActivityId.set(id);
    this.showDeleteConfirm.set(true);
  }

  confirmDeleteActivity(): void {
    const id = this.selectedActivityId();
    if (id) {
      this.activityService.deleteActivity(id);
      this.activities.update((acts) => acts.filter((a) => a.id !== id));
      this.toast.success(this.translate.instant('activityList.deletedToast'));
      this.selectedActivityId.set(null);
    }
  }
}
