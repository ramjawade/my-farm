import { firstValueFrom } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { HomeComponent } from './home.component';
import { AuthService } from '../../core/auth/auth.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { ActivityService } from '../activity/activity.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { CropsApiService } from '../../core/api/crops-api.service';
import { FakeCropsApiService } from '../../testing/fake-crops-api.service';
import { ActivitiesApiService } from '../../core/api/activities-api.service';
import { FakeActivitiesApiService } from '../../testing/fake-activities-api.service';
import { LandsApiService } from '../../core/api/lands-api.service';
import { FakeLandsApiService } from '../../testing/fake-lands-api.service';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { FakeReferenceDataService } from '../../testing/fake-reference-data.service';
import { IWeatherService } from '../../core/weather/weather.interface';
import { FakeWeatherService } from '../../testing/fake-weather.service';

const baseUser: FarmerRegistrationData = {
  id: 1,
  fullName: 'Test Farmer',
  phone: '1234567890',
  preferredLanguage: 'English',
  userRole: 'Farmer',
  farmName: 'Test Farm',
  farmArea: 2.0,
  farmAreaUnit: 'hectares',
  primaryCrops: [],
  waterSource: 'Rainfed',
  irrigationType: 'Manual',
  farmingMethod: 'Organic',
  locationType: 'skipped',
  location: null,
  createdAt: Date.now(),
};

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let authService: AuthService;
  let cropService: CropTimelineService;
  let activityService: ActivityService;

  beforeEach(async () => {
    // Clear storage for isolation
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        AuthService,
        CropTimelineService,
        FarmDrawService,
        { provide: CropsApiService, useClass: FakeCropsApiService },
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
        { provide: LandsApiService, useClass: FakeLandsApiService },
        { provide: ReferenceDataService, useClass: FakeReferenceDataService },
        { provide: IWeatherService, useClass: FakeWeatherService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    cropService = TestBed.inject(CropTimelineService);
    activityService = TestBed.inject(ActivityService);
    fixture.detectChanges();
  });

  it('should create the home component', () => {
    expect(component).toBeTruthy();
  });

  it('should default to public landing page (logged out state)', () => {
    expect(component.isLoggedIn()).toBeFalse();
    expect(component.currentUser()).toBeNull();

    // Check template layout renders landing page (hero)
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.landing-page')).toBeTruthy();
    expect(compiled.querySelector('.dashboard-page')).toBeFalsy();
  });

  it('should transition to dashboard page (logged in state)', () => {
    const mockUser: FarmerRegistrationData = {
      id: 1,
      fullName: 'Test Farmer',
      phone: '1234567890',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Test Farm',
      farmArea: 2.0,
      farmAreaUnit: 'hectares',
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now(),
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.isLoggedIn()).toBeTrue();
    expect(component.currentUser()).toEqual(mockUser);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.landing-page')).toBeFalsy();
    expect(compiled.querySelector('.dashboard-page')).toBeTruthy();
  });

  describe('signed-in screen', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const day = 86_400_000;

    beforeEach(() => {
      authService.login({ ...baseUser, fullName: 'Ram Jawade', village: 'Sinnar' });
      fixture.detectChanges();
    });

    it('greets the farmer by first name for the time of day', async () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', {
        homeScreen: {
          greeting: {
            morning: 'Good morning, {{name}}',
            afternoon: 'Good afternoon, {{name}}',
            evening: 'Good evening, {{name}}',
          },
        },
      });
      await firstValueFrom(translate.use('en'));
      component.now.set(new Date(2026, 9, 1, 9).getTime());
      expect(component.greeting()).toBe('Good morning, Ram');
      component.now.set(new Date(2026, 9, 1, 14).getTime());
      expect(component.greeting()).toBe('Good afternoon, Ram');
      component.now.set(new Date(2026, 9, 1, 20).getTime());
      expect(component.greeting()).toBe('Good evening, Ram');
      expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
    });

    it('shows the avatar initial linking to Profile and a Log activity button', () => {
      const avatar = fixture.nativeElement.querySelector('a[href="/profile"]') as HTMLAnchorElement;
      expect(avatar.textContent?.trim()).toBe('R');
      expect(avatar.classList).toContain('d-md-none');
      const log = fixture.nativeElement.querySelector('a[href="/activities/create"]');
      expect(log.classList).toContain('d-none');
    });

    it('renders the five cards in the phone order: weather, attention, today, farm', () => {
      const order = Array.from(
        fixture.nativeElement.querySelectorAll(
          '.home-grid [class^="home-"]',
        ) as NodeListOf<HTMLElement>,
      ).map((el) => el.className);
      expect(
        order
          .filter((c) => /home-(weather|attention|today|farm)\b/.test(c))
          .map((c) => c.match(/home-(weather|attention|today|farm)/)![1]),
      ).toEqual(['weather', 'attention', 'today', 'farm']);
    });

    it('totals the area of all saved lands in the tiles', () => {
      component.farms.set([
        { id: 1, name: 'A', points: [], area: { squareMeters: 0, hectares: 0, acres: 2 } } as any,
        { id: 2, name: 'B', points: [], area: { squareMeters: 0, hectares: 0, acres: 3.5 } } as any,
      ]);
      expect(component.tiles().landsCount).toBe(2);
      expect(component.tiles().totalAcres).toBeCloseTo(5.5);
      expect(component.place()).toBe('Sinnar');
    });

    it("counts only this season's expenses and active crops", async () => {
      const crop = await cropService.addCrop({
        fieldId: 1,
        name: 'Onion',
        cropCatalogId: 1,
        area: 1,
        areaUnit: 'acres',
        currentStage: 'Sowing',
        status: 'Active',
        sowingDate: Date.now() - 3 * day,
      });
      await cropService.addActivity({
        cropId: crop.id,
        activityTypeId: 1,
        date: Date.now(),
        status: 'Completed',
        cost: 800,
        notes: '',
      });
      expect(component.tiles().activeCrops).toBe(1);
      expect(component.tiles().seasonSpend).toBe(800);
    });

    it('lists an overdue activity as needing attention and opens it', async () => {
      const act = await activityService.addActivity({
        date: Date.now() - 2 * day,
        activityTypeId: 1,
        status: 'Scheduled',
      } as any);
      fixture.detectChanges();
      expect(component.attention().map((i) => i.activity?.id)).toEqual([act.id]);
      expect(component.attention()[0].badge).toEqual({ kind: 'overdue', days: 2 });

      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.openAttention(component.attention()[0]);
      expect(navigate).toHaveBeenCalledWith(['/activities', act.id]);
    });

    it("lists today's work and completes an activity when it is checked", async () => {
      const act = await activityService.addActivity({
        date: Date.now(),
        activityTypeId: 1,
        status: 'Scheduled',
      } as any);
      fixture.detectChanges();
      expect(component.today().map((i) => [i.activity.id, i.done])).toEqual([[act.id, false]]);

      component.completeToday(component.today()[0]);
      fixture.detectChanges();
      expect(activityService.getActivityById(act.id)?.status).toBe('Completed');
      expect(component.today().map((i) => i.done)).toEqual([true]);
    });

    it('shows All clear and nothing planned for a quiet farm', () => {
      expect(component.attention()).toEqual([]);
      expect(component.today()).toEqual([]);
      expect(text()).toContain('homeScreen.attention.allClear');
      expect(text()).toContain('homeScreen.today.nothing');
    });

    it('says nothing is planted and links to Add crop when there are no crops', () => {
      expect(text()).toContain('homeScreen.farm.nothingPlanted');
      expect(fixture.nativeElement.querySelector('a[href="/crops/add"]')).not.toBeNull();
    });

    it('opens a crop from the farm card', async () => {
      const crop = await cropService.addCrop({
        fieldId: 1,
        name: 'Onion',
        cropCatalogId: 1,
        area: 1,
        areaUnit: 'acres',
        currentStage: 'Sowing',
        status: 'Active',
      });
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.openCrop(crop);
      expect(navigate).toHaveBeenCalledWith(['/crops', crop.id]);
    });
  });

  it('should show the onboarding checklist for a fresh registration', () => {
    authService.login({
      id: 2,
      fullName: 'New Farmer',
      phone: '9000000000',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: '',
      farmArea: 0,
      farmAreaUnit: 'hectares',
      primaryCrops: [],
      waterSource: '',
      irrigationType: '',
      farmingMethod: '',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now(),
    });
    fixture.detectChanges();

    expect(component.showOnboarding()).toBeTrue();
    expect(component.onboardingSteps().every((s) => !s.done)).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-onboarding-checklist')).toBeTruthy();
  });

  it('should mark the profile onboarding step done once village and state are saved, regardless of farmSetupCompleted', () => {
    authService.login({ ...baseUser, farmSetupCompleted: false, village: 'Wardha', state: 'MH' });
    fixture.detectChanges();

    const profileStep = component.onboardingSteps().find((s) => s.id === 'profile');
    expect(profileStep?.done).toBeTrue();
  });

  it('should hide the onboarding checklist once every step is genuinely complete', async () => {
    authService.login({ ...baseUser, village: 'Wardha', state: 'MH' });
    component.farms.set([
      {
        id: 1,
        name: 'Land 1',
        points: [],
        area: { squareMeters: 10000, hectares: 1.0, acres: 2.47 },
        geoJson: {},
        createdAt: Date.now(),
      },
    ]);
    await cropService.addCrop({
      fieldId: 1,
      name: 'Wheat',
      cropCatalogId: 1,
      area: 1.0,
      areaUnit: 'hectares',
      season: 'Kharif',
      sowingDate: Date.now(),
      currentStage: 'Sowing',
      status: 'Active',
    });
    await activityService.addActivity({
      date: Date.now(),
      season: 'Kharif',
      activityTypeId: 5,
      status: 'Completed',
    });
    fixture.detectChanges();

    expect(component.onboardingSteps().every((s) => s.done)).toBeTrue();
    expect(component.showOnboarding()).toBeFalse();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-onboarding-checklist')).toBeFalsy();
  });

  it('should set activeSection to setup and show dialog when openSetupDialog is called', () => {
    component.openSetupDialog();
    expect(component.activeSection()).toBe('setup');
    expect(component.showEditDialog()).toBeTrue();
  });

  it('should set activeSection to land and show dialog when openLandDialog is called', () => {
    component.openLandDialog();
    expect(component.activeSection()).toBe('land');
    expect(component.showEditDialog()).toBeTrue();
  });

  describe('Activity Synchronization', () => {
    beforeEach(() => {
      // Login to establish user context for storage key calculations
      const mockUser: FarmerRegistrationData = {
        id: 1,
        fullName: 'Test Farmer',
        phone: '1234567890',
        preferredLanguage: 'English',
        userRole: 'Farmer',
        farmName: 'Test Farm',
        farmArea: 2.0,
        farmAreaUnit: 'hectares',
        primaryCrops: [],
        waterSource: 'Rainfed',
        irrigationType: 'Manual',
        farmingMethod: 'Organic',
        locationType: 'skipped',
        location: null,
        createdAt: Date.now(),
      };
      authService.login(mockUser);
      fixture.detectChanges();
    });

    it('should expose an activity logged on the crop timeline through ActivityService', async () => {
      const initialCropActivitiesCount = cropService.activities().length;

      const newCropAct = await cropService.addActivity({
        cropId: 42,
        activityTypeId: 2,
        date: Date.now(),
        status: 'Completed',
        cost: 250,
        notes: 'Irrigated for 30 minutes',
        metadata: { duration: 30, irrigationMethod: 'Drip' },
      });

      // Assert synced in CropTimelineService
      expect(cropService.activities().length).toBe(initialCropActivitiesCount + 1);

      // Assert visible through ActivityService
      const syncedFarmAct = activityService.activities().find((a) => a.id === newCropAct.id);
      expect(syncedFarmAct).toBeTruthy();
      expect(syncedFarmAct?.activityTypeId).toBe(2);
      expect(syncedFarmAct?.cropId).toBe(42);
      expect(syncedFarmAct?.notes).toBe('Irrigated for 30 minutes');
      expect(syncedFarmAct?.status).toBe('Completed');

      // Assert expense synced
      const expenses = activityService.getExpensesForActivity(newCropAct.id);
      expect(expenses.length).toBe(1);
      expect(expenses[0].amount).toBe(250);
    });

    it('should expose an activity created in ActivityService on the crop timeline', async () => {
      const initialFarmActivitiesCount = activityService.activities().length;

      const newFarmAct = await activityService.addActivity({
        date: new Date('2026-06-13').getTime(),
        season: 'Kharif',
        activityTypeId: 5,
        cropId: 42,
        fieldId: 7,
        status: 'Completed',
        notes: 'Manual mechanical weeding',
      });

      expect(activityService.activities().length).toBe(initialFarmActivitiesCount + 1);

      const syncedCropAct = cropService.activities().find((a) => a.id === newFarmAct.id);
      expect(syncedCropAct).toBeDefined();
      expect(syncedCropAct!.activityTypeId).toBe(5);
      expect(syncedCropAct!.cropId).toBe(42);
      expect(syncedCropAct!.notes).toBe('Manual mechanical weeding');
      expect(syncedCropAct!.status).toBe('Completed');
    });
  });

  describe('weather card', () => {
    const pinned: FarmerRegistrationData = {
      ...baseUser,
      village: 'Hadapsar',
      state: 'Maharashtra',
      locationType: 'map',
      location: { lat: 18.5, lng: 73.8 },
    };
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    let weather: FakeWeatherService;

    beforeEach(() => {
      weather = TestBed.inject(IWeatherService) as unknown as FakeWeatherService;
    });

    it('asks the farmer to set a location instead of showing invented weather', () => {
      authService.login(baseUser); // no land, no pinned location
      fixture.detectChanges();

      expect(component.weatherLocation()).toBeNull();
      expect(text()).toContain('home.weatherNoLocation');
      expect(text()).not.toContain('28°C');
      expect(text()).not.toContain('home.dripAdvisoryBody');
    });

    it('shows the real conditions from the weather service', () => {
      authService.login(pinned);
      weather.publish({ temp: 33, feelsLike: 36, humidity: 41, windSpeed: 9 });
      fixture.detectChanges();

      expect(text()).toContain('33°C');
      expect(text()).toContain('41%');
      expect(text()).toContain('9 km/h');
      expect(text()).not.toContain('28°C');
      expect(text()).not.toContain('68%');
    });

    it('says so when the weather is sample data', () => {
      authService.login(pinned);
      weather.publish({ temp: 29 }, 'demo');
      fixture.detectChanges();

      expect(text()).toContain('home.weatherSample');
    });

    it('does not show the sample-data notice for live weather', () => {
      authService.login(pinned);
      weather.publish({ temp: 29 }, 'live');
      fixture.detectChanges();

      expect(text()).not.toContain('home.weatherSample');
    });

    it('uses the centre of the first saved land when there is one', () => {
      authService.login(baseUser);
      component.farms.set([
        {
          id: 1,
          name: 'North Plot',
          points: [
            { lat: 10, lng: 20 },
            { lat: 12, lng: 22 },
          ],
        } as any,
      ]);

      expect(component.weatherLocation()).toEqual({ lat: 11, lng: 21, name: 'North Plot' });
    });

    it('falls back to the profile pin when there is no saved land', () => {
      authService.login(pinned);

      expect(component.weatherLocation()).toEqual({ lat: 18.5, lng: 73.8, name: 'Hadapsar' });
    });

    it('fetches weather for the location when the dashboard opens', async () => {
      authService.login(pinned);
      const reopened = TestBed.createComponent(HomeComponent);
      reopened.detectChanges();
      await reopened.whenStable();

      expect(weather.requested).toEqual([{ lat: 18.5, lng: 73.8, name: 'Hadapsar' }]);
    });
  });
});
