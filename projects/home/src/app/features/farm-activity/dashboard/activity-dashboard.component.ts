import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActivitiesSummaryComponent } from '../summary/activities-summary.component';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { CropActivity } from '../../crop-timeline/crop-timeline.models';

@Component({
  selector: 'app-activity-dashboard',
  standalone: true,
  imports: [ActivitiesSummaryComponent],
  templateUrl: './activity-dashboard.component.html',
  styleUrl: './activity-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDashboardComponent {
  private readonly router = inject(Router);
  readonly timelineService = inject(CropTimelineService);
  readonly activities = this.timelineService.activities;

  onEditActivity(act: CropActivity): void {
    this.router.navigate(['/activities/create'], { queryParams: { activityId: act.id } });
  }

  onMarkActivityCompleted(id: string): void {
    this.timelineService.updateActivity(id, {
      status: 'Completed',
      date: Date.now(),
    });
  }
}
