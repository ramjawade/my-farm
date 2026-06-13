import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivitiesSummaryComponent } from '../summary/activities-summary.component';

@Component({
  selector: 'app-activity-dashboard',
  standalone: true,
  imports: [ActivitiesSummaryComponent],
  templateUrl: './activity-dashboard.component.html',
  styleUrl: './activity-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityDashboardComponent {
}


