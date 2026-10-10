import { LocaleService } from '../../core/i18n/locale.service';
import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { I18n } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';
import { IWeatherService } from '../../core/weather/weather.interface';
import { WeatherLocation } from '../../core/weather/weather.models';
import { centroidOf } from '../../core/weather/weather-location.util';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivityService } from '../activity/activity.service';
import { resolveReferenceName } from '../../core/i18n/reference-name';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { SavedFarm } from '../../map/models/map.models';
import { CropEntity } from '../crop-timeline/crop-timeline.models';
import {
  AttentionItem,
  TodayItem,
  attentionItems,
  greetingFor,
  keyTiles,
  todayItems,
} from './home-summary';
import { HomeAttentionCardComponent } from './cards/home-attention-card.component';
import { HomeFarmCardComponent } from './cards/home-farm-card.component';
import { HomeKeyTilesComponent } from './cards/home-key-tiles.component';
import { HomeTodayCardComponent } from './cards/home-today-card.component';
import { HomeWeatherCardComponent } from './cards/home-weather-card.component';

import { ProfileEditDialogComponent } from '../profile/components/profile-edit-dialog.component';
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
    RouterLink,
    HomeAttentionCardComponent,
    HomeFarmCardComponent,
    HomeKeyTilesComponent,
    HomeTodayCardComponent,
    HomeWeatherCardComponent,
    ProfileEditDialogComponent,
    OnboardingChecklistComponent,
    WorkflowProgressBarComponent,
    TranslatePipe,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private readonly locale = inject(LocaleService);
  readonly authService = inject(AuthService);
  private readonly cropService = inject(CropTimelineService);
  private readonly activityService = inject(ActivityService);
  private readonly farmDrawService = inject(FarmDrawService);
  private readonly weatherService = inject(IWeatherService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18n);

  readonly farms = signal<SavedFarm[]>([]);

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      // Crops and activities are already loaded by their services on sign-in and kept
      // current by every mutation; reloading them here only repeated both requests.
      this.farms.set(await this.farmDrawService.loadFarms(user.id));
      if (this.farms().length > 0) {
        this.workflowService.markPhaseComplete('land');
      }
      const location = this.weatherLocation();
      if (location) {
        void this.weatherService.getWeatherData(location);
      }
    }
  }

  /**
   * Where to fetch weather for: the first saved land's centre, else the profile's pinned
   * location. `null` when the farmer has set neither (no guessing a place for them).
   */
  readonly weatherLocation = computed<WeatherLocation | null>(() => {
    const farm = this.farms()[0];
    const centre = farm ? centroidOf(farm.points) : null;
    if (farm && centre) return { ...centre, name: farm.name };
    const location = this.currentUser()?.location;
    return location ? { ...location, name: this.currentUser()?.village } : null;
  });

  /** Real conditions for the card; `null` until loaded or when there is no location. */
  readonly currentWeather = computed(() =>
    this.weatherLocation() ? (this.weatherService.weatherData()?.current ?? null) : null,
  );

  /** True when the weather shown is sample data, not a real forecast. */
  readonly weatherIsSample = computed(() => this.weatherService.source() === 'demo');

  // Authentication State
  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly currentUser = this.authService.currentUser;

  // Farm Setup Progressive Profiling Signals
  readonly showEditDialog = signal(false);
  readonly activeSection = signal<'account' | 'agronomic' | 'land' | 'operations' | 'setup'>(
    'setup',
  );

  /** Setup steps for a new farmer; the card hides once every step is done. */
  readonly onboardingSteps = computed<OnboardingStep[]>(() => {
    const hasActivity = this.activityService.activities().length > 0;
    return [
      {
        id: 'profile',
        title: this.translate.instant('home.onboarding.profile.title'),
        description: this.translate.instant('home.onboarding.profile.description'),
        icon: 'bi-person-gear',
        done: this.hasLocation(),
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

  // Profile completeness check
  readonly hasBoundary = computed(() => {
    return this.farms().length > 0;
  });

  readonly hasLocation = computed(() => {
    const user = this.currentUser();
    return !!(user && user.village && user.state);
  });

  // ----- Signed-in Home -----

  /** The moment the screen's numbers are worked out for. */
  readonly now = signal(Date.now());

  readonly tiles = computed(() =>
    keyTiles(this.cropService.crops(), this.farms(), this.activityService.expenses(), this.now()),
  );

  /** The village or district shown under the total area. */
  readonly place = computed(() => {
    const user = this.currentUser();
    return user?.village || user?.district || '';
  });

  readonly attention = computed(() =>
    attentionItems(this.activityService.activities(), this.cropService.crops(), this.now()),
  );

  readonly today = computed(() => todayItems(this.activityService.activities(), this.now()));

  readonly crops = this.cropService.crops;

  /** The land picked on the map; until one is picked, the first land. */
  private readonly pickedLandId = signal<number | null>(null);

  readonly selectedLand = computed(
    () => this.farms().find((f) => f.id === this.pickedLandId()) ?? this.farms()[0] ?? null,
  );

  /** Crops of the selected land; all crops when there are no lands. */
  readonly landCrops = computed(() => {
    const land = this.selectedLand();
    return land ? this.crops().filter((c) => c.fieldId === land.id) : this.crops();
  });

  /** The map label under each land's name: its crops and area. */
  readonly landDetails = computed(() => {
    const none = this.i18n.t('homeScreen.farm.noCropYet');
    return Object.fromEntries(
      this.farms().map((land) => {
        const names = this.crops()
          .filter((c) => c.fieldId === land.id)
          .map((c) => resolveReferenceName(this.translate, 'crop', c.name));
        return [land.id, `${names.join(', ') || none} · ${land.area.acres.toFixed(1)} ac`];
      }),
    );
  });

  selectLand(id: number): void {
    this.pickedLandId.set(id);
  }

  /** Expenses logged per crop, for the farm card. */
  readonly costByCrop = computed(() =>
    Object.fromEntries(
      this.cropService.crops().map((crop) => [crop.id, this.cropService.costForCrop(crop.id)]),
    ),
  );

  readonly forecastDays = computed(() => this.weatherService.weatherData()?.forecast?.days ?? []);

  readonly greeting = computed(() => {
    const user = this.currentUser();
    const name = user?.fullName.split(' ')[0] || this.i18n.t('common.farmer');
    const period = greetingFor(new Date(this.now()).getHours());
    return this.i18n.t('homeScreen.greeting.' + period, { name });
  });

  /** The date, and the temperature and conditions when the weather has loaded. */
  readonly subtitle = computed(() => {
    const date = this.locale.date(this.now(), 'EEEE d MMM');
    const weather = this.currentWeather();
    return weather ? date + ' · ' + Math.round(weather.temp) + '°C, ' + weather.condition : date;
  });

  readonly initial = computed(() =>
    (this.currentUser()?.fullName ?? '').trim().charAt(0).toUpperCase(),
  );

  completeToday(item: TodayItem): void {
    this.cropService.completeActivity(item.activity.id);
  }

  openAttention(item: AttentionItem): void {
    if (item.activity) {
      void this.router.navigate(['/activities', item.activity.id]);
    } else if (item.crop) {
      void this.router.navigate(['/crops', item.crop.id]);
    }
  }

  openCrop(crop: CropEntity): void {
    void this.router.navigate(['/crops', crop.id]);
  }
}
