import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe, CommonModule } from '@angular/common';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../../map/models/map.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Activity } from '../../activity/activity.models';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { activityTypeEmoji } from '../../activity/activity-display';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { ReferenceItem } from '../../../core/api/contracts';

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
  private readonly toast = inject(ToastService);
  private readonly cropService = inject(CropTimelineService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly referenceDataService = inject(ReferenceDataService);

  readonly savedFarms = signal<SavedFarm[]>([]);
  readonly referenceActivityTypes = signal<ReferenceItem[]>([]);

  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe((params) => {
      const status = params['status'];
      if (status) {
        this.statusFilter.set(status);
      } else {
        this.statusFilter.set('All');
      }
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

  readonly showDeleteConfirm = signal(false);
  readonly selectedActivityId = signal<string | null>(null);
  readonly viewMode = signal<'grid' | 'list'>('grid');

  // Active filters using Signals
  readonly seasonFilter = signal<string>('All');
  readonly cropFilter = signal<string>('All');
  readonly fieldFilter = signal<string>('All');
  readonly typeFilter = signal<string>('All');
  readonly statusFilter = signal<string>('All');
  readonly sortBy = signal<string>('latest');
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

  // Fields list can combine drawn farms and unique field IDs from activities
  readonly fieldsList = computed(() => {
    const saved = this.savedFarms().map((f) => ({ id: f.id, name: f.name }));
    const activeFieldNames = this.activityService
      .activities()
      .map((a) => a.fieldId)
      .filter((fid): fid is string => !!fid && !saved.some((f) => f.id === fid));

    const uniqueActiveFields = Array.from(new Set(activeFieldNames)).map((name) => ({
      id: name,
      name,
    }));
    return [...saved, ...uniqueActiveFields];
  });

  // Dynamic activity types from reference data service
  readonly activityTypesList = computed(() => {
    const referenceTypes = this.referenceActivityTypes().map((t) => t.name);
    const recorded = this.activityService.activities().map((a) => a.type);
    return Array.from(new Set([...referenceTypes, ...recorded]));
  });

  // Main filtered & sorted list
  readonly filteredActivities = computed(() => {
    let list = this.activityService.activities();

    const season = this.seasonFilter();
    if (season !== 'All') {
      list = list.filter((a) => a.season === season);
    }

    const crop = this.cropFilter();
    if (crop !== 'All') {
      list = list.filter((a) => a.cropId === crop);
    }

    const field = this.fieldFilter();
    if (field !== 'All') {
      list = list.filter((a) => a.fieldId === field);
    }

    const type = this.typeFilter();
    if (type !== 'All') {
      list = list.filter((a) => a.type === type);
    }

    const status = this.statusFilter();
    if (status !== 'All') {
      list = list.filter((a) => a.status === status);
    }

    // Apply Sorting
    const sort = this.sortBy();
    if (sort === 'latest') {
      list = [...list].sort((a, b) => (b.date || 0) - (a.date || 0));
    } else if (sort === 'oldest') {
      list = [...list].sort((a, b) => (a.date || 0) - (b.date || 0));
    } else if (sort === 'cost') {
      list = [...list].sort(
        (a, b) => this.getActivityTotalCost(b.id) - this.getActivityTotalCost(a.id),
      );
    }

    return list;
  });

  getActivityTotalCost(activityId: string): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }

  getCropName(cropId?: string): string {
    if (!cropId) return '';
    const crop = this.cropsList().find((c) => c.id === cropId);
    return crop ? crop.name : 'Unknown Crop';
  }

  getFieldName(fieldId?: string): string {
    if (!fieldId) return '';
    const farm = this.fieldsList().find((f) => f.id === fieldId);
    return farm ? farm.name : fieldId;
  }

  // Filter setters
  setSeason(val: string): void {
    this.seasonFilter.set(val);
  }
  setCrop(val: string): void {
    this.cropFilter.set(val);
  }
  setField(val: string): void {
    this.fieldFilter.set(val);
  }
  setType(val: string): void {
    this.typeFilter.set(val);
  }
  setStatus(val: string): void {
    this.statusFilter.set(val);
  }
  setSort(val: string): void {
    this.sortBy.set(val);
  }

  clearFilters(): void {
    this.seasonFilter.set('All');
    this.cropFilter.set('All');
    this.fieldFilter.set('All');
    this.typeFilter.set('All');
    this.statusFilter.set('All');
    this.sortBy.set('latest');

    // Clear URL query parameters
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  getActivityEmoji = activityTypeEmoji;

  onDeleteActivityClick(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectedActivityId.set(id);
    this.showDeleteConfirm.set(true);
  }

  confirmDeleteActivity(): void {
    const id = this.selectedActivityId();
    if (id) {
      this.activityService.deleteActivity(id);
      this.toast.success('Activity deleted.');
      this.selectedActivityId.set(null);
    }
  }
}
