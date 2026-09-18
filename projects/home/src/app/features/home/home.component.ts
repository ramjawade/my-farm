import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivityService } from '../activity/activity.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../map/models/map.models';
import { Activity } from '../activity/activity.models';
import { daysAfterSowing, stageProgressPercent } from '../crop-timeline/crop-timeline.utils';

import { ProfileEditDialogComponent } from '../profile/components/profile-edit-dialog.component';
import { ReferenceNamePipe } from '../../core/i18n/reference-name.pipe';
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
    TranslatePipe,
    ReferenceNamePipe,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly cropService = inject(CropTimelineService);
  private readonly activityService = inject(ActivityService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly farms = signal<SavedFarm[]>([]);

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      this.farms.set(await this.farmDrawService.loadFarms(user.id));
      void this.cropService.reload();
      void this.activityService.reload();
    }
  }

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
        title: this.translate.instant('home.onboarding.profile.title'),
        description: this.translate.instant('home.onboarding.profile.description'),
        icon: 'bi-person-gear',
        done: !!(user?.farmSetupCompleted && this.hasLocation()),
        actionLabel: this.translate.instant('home.onboarding.profile.action'),
      },
      {
        id: 'land',
        title: this.translate.instant('home.onboarding.land.title'),
        description: this.translate.instant('home.onboarding.land.description'),
        icon: 'bi-map',
        done: this.hasBoundary(),
        route: '/map',
        actionLabel: this.translate.instant('home.onboarding.land.action'),
      },
      {
        id: 'crop',
        title: this.translate.instant('home.onboarding.crop.title'),
        description: this.translate.instant('home.onboarding.crop.description'),
        icon: 'bi-flower1',
        done: this.cropService.crops().length > 0,
        route: '/crops/add',
        actionLabel: this.translate.instant('home.onboarding.crop.action'),
      },
      {
        id: 'activity',
        title: this.translate.instant('home.onboarding.activity.title'),
        description: this.translate.instant('home.onboarding.activity.description'),
        icon: 'bi-journal-plus',
        done: hasActivity,
        route: '/activities/create',
        actionLabel: this.translate.instant('home.onboarding.activity.action'),
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
    let greetingKey = 'home.greeting.welcomeBack';
    let icon = 'bi-sun-fill text-warning';

    if (hour >= 5 && hour < 12) {
      greetingKey = 'home.greeting.goodMorning';
      icon = 'bi-sunrise-fill text-warning';
    } else if (hour >= 12 && hour < 17) {
      greetingKey = 'home.greeting.goodAfternoon';
      icon = 'bi-sun-fill text-warning';
    } else if (hour >= 17 && hour < 22) {
      greetingKey = 'home.greeting.goodEvening';
      icon = 'bi-sunset-fill text-danger';
    } else {
      greetingKey = 'home.greeting.goodNight';
      icon = 'bi-moon-stars-fill text-primary';
    }

    const user = this.currentUser();
    const name = user ? user.fullName.split(' ')[0] : this.translate.instant('common.farmer');
    const text = this.translate.instant(greetingKey, { name });
    return { text, icon };
  });

  // Profile completeness check
  readonly hasBoundary = computed(() => {
    return this.farms().length > 0;
  });

  readonly hasLocation = computed(() => {
    const user = this.currentUser();
    return !!(user && user.village && user.state);
  });

  // Dynamic Metrics Summary
  readonly metrics = computed(() => {
    const cropsCount = this.cropService.crops().length;
    const user = this.currentUser();

    const savedFarmsList = this.farms();
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

    const todayTasks = this.activityService.todaysPendingActivities().length;

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
    const lastActByC = this.cropService.lastActivityDateByCrop();
    return crops.map((crop) => {
      const days = daysAfterSowing(crop.sowingDate);
      const progressPercent = stageProgressPercent(crop.currentStage);

      let lastActivityDays = -1;
      const lastActDate = lastActByC[crop.id];
      if (lastActDate) {
        lastActivityDays = Math.floor((Date.now() - lastActDate) / (1000 * 60 * 60 * 24));
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
          cropName: crop ? crop.name : this.translate.instant('home.generalFarm'),
          isToday: act.date ? new Date(act.date).toISOString().split('T')[0] === todayStr : false,
          dateLabel: this.formatDate(act.date),
        };
      });
  });

  // Today's pending activities
  readonly todayActivities = computed(() => this.activityService.todaysPendingActivities());

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
