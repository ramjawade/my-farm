import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ActivityService } from '../activity/activity.service';

@Component({
  selector: 'app-farm-activity',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styleUrl: './farm-activity.component.scss',
})
export class FarmActivityComponent implements OnInit {
  private readonly activityService = inject(ActivityService);

  ngOnInit(): void {
    void this.activityService.reload();
  }
}
