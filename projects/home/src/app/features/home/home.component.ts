import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivityService } from '../activity/activity.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { Activity } from '../activity/activity.models';

import { ProfileEditDialogComponent } from '../profile/components/profile-edit-dialog.component';
import { DemoDataService } from '../../core/demo/demo-data.service';
import { ToastService } from 'shared';
import {
  OnboardingChecklistComponent,
  OnboardingStep,
} from './onboarding-checklist/onboarding-checklist.component';
import { WorkflowProgressBarComponent } from '../shared/components/workflow-progress-bar.component';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProfileEditDialogComponent,
    OnboardingChecklistComponent,
    WorkflowProgressBarComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly authService = inject(AuthService);
  private readonly cropService = inject(CropTimelineService);
  private readonly activityService = inject(ActivityService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly router = inject(Router);
  private readonly demoData = inject(DemoDataService);
  private readonly toast = inject(ToastService);

  // Authentication State
  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly currentUser = this.authService.currentUser;

  // Farm Setup Progressive Profiling Signals
  readonly showEditDialog = signal(false);
  readonly activeSection = signal<'account' | 'agronomic' | 'land' | 'operations' | 'setup'>(
    'setup',
  );

  readonly showFarmSetupPrompt = computed(() => {
    const user = this.currentUser();
    return user ? !user.farmSetupCompleted : false;
  });

  /** Setup steps for a new farmer; the card hides once every step is done. */
  readonly onboardingSteps = computed<OnboardingStep[]>(() => {
    const user = this.currentUser();
    const hasActivity = this.activityService.activities().length > 0;
    return [
      {
        id: 'profile',
        title: 'Complete your farm profile',
        description: 'Village, water source and farming method personalise weather and advice.',
        icon: 'bi-person-gear',
        done: !!(user?.farmSetupCompleted && this.hasLocation()),
        actionLabel: 'Set up',
      },
      {
        id: 'land',
        title: 'Draw your first land',
        description: 'Outline a plot on the map to get its exact area.',
        icon: 'bi-map',
        done: this.hasBoundary(),
        route: '/map',
        actionLabel: 'Open map',
      },
      {
        id: 'crop',
        title: 'Add a crop on that land',
        description: 'Track it from land preparation to harvest.',
        icon: 'bi-flower1',
        done: this.cropService.crops().length > 0,
        route: '/crops/add',
        actionLabel: 'Add crop',
      },
      {
        id: 'activity',
        title: 'Log your first activity',
        description: 'Record work and expenses so costs roll up per crop.',
        icon: 'bi-journal-plus',
        done: hasActivity,
        route: '/activities/create',
        actionLabel: 'Log activity',
      },
    ];
  });

  readonly showOnboarding = computed(() => this.onboardingSteps().some((s) => !s.done));

  openSetupDialog(): void {
    this.activeSection.set('setup');
    this.showEditDialog.set(true);
  }

  openLandDialog(): void {
    this.activeSection.set('land');
    this.showEditDialog.set(true);
  }

  onOnboardingAction(id: string): void {
    if (id === 'profile') {
      this.openSetupDialog();
    }
  }

  // Time-of-day Greeting Signal
  readonly greetingInfo = computed(() => {
    const hour = new Date().getHours();
    let text = 'Welcome back';
    let icon = 'bi-sun-fill text-warning';

    if (hour >= 5 && hour < 12) {
      text = 'Good morning';
      icon = 'bi-sunrise-fill text-warning';
    } else if (hour >= 12 && hour < 17) {
      text = 'Good afternoon';
      icon = 'bi-sun-fill text-warning';
    } else if (hour >= 17 && hour < 22) {
      text = 'Good evening';
      icon = 'bi-sunset-fill text-danger';
    } else {
      text = 'Good night';
      icon = 'bi-moon-stars-fill text-primary';
    }

    const user = this.currentUser();
    const name = user ? user.fullName.split(' ')[0] : 'Farmer';
    return { text: `${text}, ${name}!`, icon };
  });

  // Profile completeness check
  readonly hasBoundary = computed(() => {
    return this.farmDrawService.savedFarms().length > 0;
  });

  readonly hasLocation = computed(() => {
    const user = this.currentUser();
    return !!(user && user.village && user.state);
  });

  // Dynamic Metrics Summary
  readonly metrics = computed(() => {
    const cropsCount = this.cropService.crops().length;
    const user = this.currentUser();

    const savedFarmsList = this.farmDrawService.savedFarms();
    const landsCount = savedFarmsList.length;
    const unit = user?.farmAreaUnit || 'hectares';

    let acreage = 0;
    if (landsCount > 0) {
      const totalArea = savedFarmsList.reduce((sum, f) => {
        const val = unit === 'acres' ? f.area.acres : f.area.hectares;
        return sum + val;
      }, 0);
      acreage = Math.round(totalArea * 100) / 100;
    } else {
      acreage = user && user.farmArea ? user.farmArea : 0;
    }

    const allActs = this.activityService.activities();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = allActs.filter((a) => {
      if (!a.date) return false;
      const aStr = new Date(a.date).toISOString().split('T')[0];
      return aStr === todayStr && a.status !== 'Completed';
    }).length;

    // Calculate total expenses this month
    const currentMonth = new Date().getMonth();
    const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
    const currentYear = new Date().getFullYear();
    const totalExpenses = this.activityService
      .expenses()
      .filter((e) => {
        const d = new Date(e.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      cropsCount,
      acreage,
      todayTasks,
      totalExpenses,
      landsCount,
      monthName,
    };
  });

  // Active Crops list with formatted stages
  readonly activeCrops = computed(() => {
    const crops = this.cropService.crops();
    return crops.map((crop) => {
      // Calculate days after sowing
      let days: number | null = null;
      if (crop.sowingDate) {
        const diff = Date.now() - crop.sowingDate;
        days = isNaN(diff) ? null : Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      // Determine stage index and progress (out of 8 stages)
      const stages = [
        'Land Preparation',
        'Sowing',
        'Germination',
        'Vegetative Growth',
        'Flowering',
        'Fruiting / Pod Formation',
        'Maturity',
        'Harvest',
      ];
      const stageIndex = stages.indexOf(crop.currentStage);
      const progressPercent =
        stageIndex >= 0 ? Math.round(((stageIndex + 1) / stages.length) * 100) : 0;

      // Check if no activity logged recently (e.g. 7 days)
      const cropActs = this.activityService
        .activities()
        .filter((a) => a.cropId === crop.id && a.status === 'Completed')
        .sort((a, b) => (b.date || 0) - (a.date || 0));

      let lastActivityDays = -1;
      if (cropActs.length > 0 && cropActs[0].date) {
        const diff = Date.now() - cropActs[0].date;
        lastActivityDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      return {
        ...crop,
        daysAfterSowing: days,
        progressPercent,
        noRecentActivity: lastActivityDays > 7 || lastActivityDays === -1,
      };
    });
  });

  // Upcoming scheduled / planned activities (limit to 3 for summary view)
  readonly upcomingActivities = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.activityService
      .activities()
      .filter((a) => a.status !== 'Completed')
      .sort((a, b) => {
        const timeA = a.date !== undefined ? a.date : Infinity;
        const timeB = b.date !== undefined ? b.date : Infinity;
        return timeA - timeB;
      })
      .slice(0, 3)
      .map((act) => {
        const crop = this.cropService.crops().find((c) => c.id === act.cropId);
        return {
          ...act,
          cropName: crop ? crop.name : 'General Farm',
          isToday: act.date ? new Date(act.date).toISOString().split('T')[0] === todayStr : false,
          dateLabel: this.formatDate(act.date),
        };
      });
  });

  // Today's pending activities
  readonly todayActivities = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.activityService.activities().filter((a) => {
      if (!a.date) return false;
      const aStr = new Date(a.date).toISOString().split('T')[0];
      return aStr === todayStr && a.status !== 'Completed';
    });
  });

  // Guest demo: one coherent seeded farm, owned by DemoDataService
  loginAsDemo(): Promise<void> {
    return this.demoData.enterDemo();
  }

  // Quick Action: Complete an activity task from the list
  completeActivityTask(id: string): void {
    this.activityService.updateActivity(id, { status: 'Completed' });
    this.toast.success('Task marked as completed.');
  }

  private formatDate(timestamp: number | undefined): string {
    if (!timestamp) return '';
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return new Date(timestamp).toLocaleDateString(undefined, options);
    } catch {
      return '';
    }
  }
}
