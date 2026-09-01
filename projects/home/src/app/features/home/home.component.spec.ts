import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HomeComponent } from './home.component';
import { AuthService } from '../../core/auth/auth.service';
import { CropTimelineService } from '../crop-timeline/crop-timeline.service';
import { FarmActivityService } from '../farm-activity/farm-activity.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let authService: AuthService;
  let cropService: CropTimelineService;
  let activityService: FarmActivityService;
  let farmDrawService: FarmDrawService;

  beforeEach(async () => {
    // Clear storage for isolation
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        AuthService,
        CropTimelineService,
        FarmActivityService,
        FarmDrawService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    cropService = TestBed.inject(CropTimelineService);
    activityService = TestBed.inject(FarmActivityService);
    farmDrawService = TestBed.inject(FarmDrawService);
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
      id: 'f-test',
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
      createdAt: Date.now()
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.isLoggedIn()).toBeTrue();
    expect(component.currentUser()).toEqual(mockUser);
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.landing-page')).toBeFalsy();
    expect(compiled.querySelector('.dashboard-page')).toBeTruthy();
  });

  it('should contain redirection links to /map and /crops on the metrics cards when logged in', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
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
      createdAt: Date.now()
    };
    authService.login(mockUser);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const farmAreaCard = compiled.querySelector('[routerLink="/map"]');
    expect(farmAreaCard).toBeTruthy();

    const activeCropsCard = compiled.querySelector('[routerLink="/crops"]');
    expect(activeCropsCard).toBeTruthy();
  });

  it('should sum all saved land areas and set landsCount in metrics', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
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
      createdAt: Date.now()
    };
    authService.login(mockUser);
    
    // Set mock saved farms
    const mockFarms = [
      {
        id: '1',
        name: 'Land 1',
        points: [],
        area: { squareMeters: 10000, hectares: 1.0, acres: 2.47 },
        geoJson: {},
        createdAt: Date.now()
      },
      {
        id: '2',
        name: 'Land 2',
        points: [],
        area: { squareMeters: 15000, hectares: 1.5, acres: 3.7 },
        geoJson: {},
        createdAt: Date.now()
      }
    ];
    localStorage.setItem('my_farm_f-test_saved_farms', JSON.stringify(mockFarms));
    farmDrawService.savedFarms.set(mockFarms);
    fixture.detectChanges();

    expect(component.metrics().acreage).toBe(2.5); // 1.0 + 1.5
    expect(component.metrics().landsCount).toBe(2);
  });

  it('should sum saved land areas in acres if farmAreaUnit is acres', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
      fullName: 'Test Farmer',
      phone: '1234567890',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Test Farm',
      farmArea: 2.0,
      farmAreaUnit: 'acres',
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now()
    };
    authService.login(mockUser);
    
    const mockFarms = [
      {
        id: '1',
        name: 'Land 1',
        points: [],
        area: { squareMeters: 10000, hectares: 1.0, acres: 2.47 },
        geoJson: {},
        createdAt: Date.now()
      },
      {
        id: '2',
        name: 'Land 2',
        points: [],
        area: { squareMeters: 15000, hectares: 1.5, acres: 3.7 },
        geoJson: {},
        createdAt: Date.now()
      }
    ];
    localStorage.setItem('my_farm_f-test_saved_farms', JSON.stringify(mockFarms));
    farmDrawService.savedFarms.set(mockFarms);
    fixture.detectChanges();

    expect(component.metrics().acreage).toBe(6.17); // 2.47 + 3.7
    expect(component.metrics().landsCount).toBe(2);
  });

  it('should trigger guest demo login when loginAsDemo is called', () => {
    expect(authService.isLoggedIn()).toBeFalse();
    component.loginAsDemo();
    fixture.detectChanges();

    expect(authService.isLoggedIn()).toBeTrue();
    expect(authService.currentUser()?.fullName).toBe('Ram Jawade');
  });

  it('should complete activity task when completeActivityTask is called', () => {
    // Setup login
    component.loginAsDemo();
    fixture.detectChanges();

    // Create a mock pending activity
    const mockActivity = activityService.addActivity({
      date: Date.now(),
      season: 'Summer',
      activityId: 'Drip Maintenance',
      status: 'In Progress'
    });

    fixture.detectChanges();

    // Verify task is in progress
    const activities = activityService.activities();
    const target = activities.find(a => a.id === mockActivity.id);
    expect(target?.status).toBe('In Progress');

    // Complete task
    component.completeActivityTask(mockActivity.id);
    fixture.detectChanges();

    // Verify status has updated to Completed
    const updatedActivities = activityService.activities();
    const updatedTarget = updatedActivities.find(a => a.id === mockActivity.id);
    expect(updatedTarget?.status).toBe('Completed');
  });

  it('should show farm setup prompt for user who has not completed setup', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
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
      createdAt: Date.now()
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showFarmSetupPrompt()).toBeTrue();
  });

  it('should hide farm setup prompt for user who has completed setup', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
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
      farmSetupCompleted: true
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showFarmSetupPrompt()).toBeFalse();
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

  it('should call openLandDialog when handleSuggestionAction("weather") is called', () => {
    spyOn(component, 'openLandDialog').and.callThrough();
    component.handleSuggestionAction('weather');
    expect(component.openLandDialog).toHaveBeenCalled();
  });

  describe('Activity Synchronization', () => {
    beforeEach(() => {
      // Login to establish user context for storage key calculations
      const mockUser: FarmerRegistrationData = {
        id: 'f-test',
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
        createdAt: Date.now()
      };
      authService.login(mockUser);
      fixture.detectChanges();
    });

    it('should synchronize activity created in CropTimelineService to FarmActivityService', () => {
      const initialCropActivitiesCount = cropService.activities().length;
      const initialFarmActivitiesCount = activityService.activities().length;

      const newCropAct = cropService.addActivity({
        cropId: 'c-test-crop',
        type: 'Irrigation',
        date: Date.now(),
        status: 'Completed',
        cost: 250,
        notes: 'Irrigated for 30 minutes',
        attachments: [],
        metadata: { duration: 30, irrigationMethod: 'Drip' }
      });

      // Assert synced in CropTimelineService
      expect(cropService.activities().length).toBe(initialCropActivitiesCount + 1);

      // Assert synced to FarmActivityService
      const syncedFarmAct = activityService.activities().find(a => a.id === newCropAct.id);
      expect(syncedFarmAct).toBeTruthy();
      expect(syncedFarmAct?.activityId).toBe('Irrigation');
      expect(syncedFarmAct?.cropId).toBe('c-test-crop');
      expect(syncedFarmAct?.notes).toBe('Irrigated for 30 minutes');
      expect(syncedFarmAct?.status).toBe('Completed');

      // Assert expense synced
      const expenses = activityService.getExpensesForActivity(newCropAct.id);
      expect(expenses.length).toBe(1);
      expect(expenses[0].amount).toBe(250);
    });

    it('should synchronize activity created in FarmActivityService to CropTimelineService', () => {
      const initialCropActivitiesCount = cropService.activities().length;
      const initialFarmActivitiesCount = activityService.activities().length;

      const newFarmAct = activityService.addActivity({
        date: new Date('2026-06-13').getTime(),
        season: 'Kharif',
        activityId: 'Weeding',
        cropId: 'c-test-crop',
        fieldId: 'Field A',
        status: 'Completed',
        notes: 'Manual mechanical weeding'
      });

      // Assert synced to FarmActivityService
      expect(activityService.activities().length).toBe(initialFarmActivitiesCount + 1);

      // Assert synced to CropTimelineService
      const syncedCropAct = cropService.activities().find((a: any) => a.id === newFarmAct.id);
      expect(syncedCropAct).toBeDefined();
      expect(syncedCropAct!.type).toBe('Weeding');
      expect(syncedCropAct!.cropId).toBe('c-test-crop');
      expect(syncedCropAct!.notes).toBe('Manual mechanical weeding');
      expect(syncedCropAct!.status).toBe('Completed');
    });
  });
});
