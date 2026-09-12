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
import { ActivityService } from '../../activity/activity.service';
import { ActivityListService } from './activity-list.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Activity } from '../../activity/activity.models';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { activityTypeEmoji } from '../../activity/activity-display';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { ReferenceItem } from '../../../core/api/contracts';
import { parseId } from '../../../core/models/entity-id';

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [RouterLink, DatePipe, CommonModule, ConfirmDialogComponent],
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent implements OnInit {
  readonly activityService = inject(ActivityService);
  private readonly activityListService = inject(ActivityListService);
  private readonly toast = inject(ToastService);
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

  // Server-backed list, loaded via ActivityListService.load() — not the
  // shared ActivityService.activities() signal cache.
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly showDeleteConfirm = signal(false);
  readonly selectedActivityId = signal<number | null>(null);
  readonly viewMode = signal<'grid' | 'list'>('grid');

  // Server-driven filters — changing these triggers reload().
  readonly statusFilter = signal<string>('All');
  readonly sortBy = signal<string>('latest');

  // Manual "Linked Crop" dropdown — server-driven like status/sort, but not
  // URL-synced. Hidden when the route already supplies a `cropId` (see html).
  readonly cropFilter = signal<string>('All');

  // Client-only filters, applied over the already-loaded batch.
  readonly seasonFilter = signal<string>('All');
  readonly fieldFilter = signal<string>('All');
  readonly typeFilter = signal<string>('All');

  readonly isCropScoped = computed(() => this.cropIdParam() !== null);

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

  // Dynamic activity types from reference data service
  readonly activityTypesList = computed(() => {
    const referenceTypes = this.referenceActivityTypes().map((t) => t.name);
    const recorded = this.activities().map((a) => a.type);
    return Array.from(new Set([...referenceTypes, ...recorded]));
  });

  // Client-only narrowing (season/field/type) + 'cost' sort over the server-loaded batch.
  readonly filteredActivities = computed(() => {
    let list = this.activities();

    const season = this.seasonFilter();
    if (season !== 'All') {
      list = list.filter((a) => a.season === season);
    }

    const field = this.fieldFilter();
    if (field !== 'All') {
      list = list.filter((a) => String(a.fieldId) === field);
    }

    const type = this.typeFilter();
    if (type !== 'All') {
      list = list.filter((a) => a.type === type);
    }

    if (this.sortBy() === 'cost') {
      list = [...list].sort(
        (a, b) => this.getActivityTotalCost(b.id) - this.getActivityTotalCost(a.id),
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    // 1. Read filter inputs first: route params, then query params.
    this.route.queryParams.subscribe((params) => {
      this.statusFilter.set(params['status'] || 'All');
      this.sortBy.set(params['sort'] || 'latest');
      this.reload();
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

  // 2. Once filters are known, load the activities that match them.
  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const manualCropId = this.cropFilter() !== 'All' ? Number(this.cropFilter()) : undefined;
      const activities = await this.activityListService.load({
        status: this.statusFilter(),
        sort: this.sortBy(),
        cropId: this.cropIdParam() ?? manualCropId,
      });
      this.activities.set(activities);
    } catch {
      this.error.set('Could not load activities. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  getActivityTotalCost(activityId: number): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }

  getCropName(cropId?: number): string {
    if (!cropId) return '';
    const crop = this.cropsList().find((c) => c.id === cropId);
    return crop ? crop.name : 'Unknown Crop';
  }

  getFieldName(fieldId?: number): string {
    if (!fieldId) return '';
    const farm = this.fieldsList().find((f) => f.id === fieldId);
    return farm ? farm.name : String(fieldId);
  }

  // Client-only filter setters — no reload needed.
  setSeason(val: string): void {
    this.seasonFilter.set(val);
  }
  setField(val: string): void {
    this.fieldFilter.set(val);
  }
  setType(val: string): void {
    this.typeFilter.set(val);
  }

  // Server-driven — re-fetches with the new crop scope.
  setCrop(val: string): void {
    this.cropFilter.set(val);
    this.reload();
  }

  // Server-driven filter setters — re-sync the URL, which triggers reload() via the
  // queryParams subscription above.
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

    // Clearing status/sort query params re-triggers reload() via the subscription.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  getActivityEmoji = activityTypeEmoji;

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
      this.toast.success('Activity deleted.');
      this.selectedActivityId.set(null);
    }
  }
}
