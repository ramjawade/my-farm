import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivityService } from '../../activity/activity.service';
import { Activity, ActivityKpiSummary } from '../../activity/activity.models';
import { activityTypeIcon } from '../../activity/activity-display';
import { parseId } from '../../../core/models/entity-id';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';

@Component({
  selector: 'app-activity-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, TranslatePipe, ReferenceNamePipe],
  templateUrl: './activity-dashboard.component.html',
  styleUrl: './activity-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDashboardComponent implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  private readonly cropIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => parseId(params.get('cropId')))),
    { initialValue: null },
  );

  readonly kpi = signal<ActivityKpiSummary | null>(null);
  readonly upcoming = signal<Activity[]>([]);
  readonly recent = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly getActivityIcon = activityTypeIcon;

  getExpenseForActivity(activityId: number): number {
    return this.activityService.getTotalExpenseForActivity(activityId);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const cropId = this.cropIdParam() ?? undefined;
    try {
      const [kpi, upcoming, recent] = await Promise.all([
        this.activityService.getKpiSummary(cropId),
        this.activityService.getUpcomingActivities(cropId, 5),
        this.activityService.getRecentActivities(cropId, 5),
      ]);
      this.kpi.set(kpi);
      this.upcoming.set(upcoming);
      this.recent.set(recent);
    } catch {
      this.error.set(this.translate.instant('activityDashboard.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  onEditActivity(id: number): void {
    this.router.navigate(['/activities/create'], { queryParams: { activityId: id } });
  }

  onMarkActivityCompleted(id: number): void {
    this.activityService.updateActivity(id, {
      status: 'Completed',
      date: Date.now(),
    });
    // Optimistic — updateActivity() persists in the background (no promise to
    // await here), so drop it from the upcoming list immediately rather than
    // racing a reload against that in-flight write.
    this.upcoming.update((acts) => acts.filter((a) => a.id !== id));
  }
}
