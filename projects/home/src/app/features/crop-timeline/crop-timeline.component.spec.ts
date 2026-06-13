import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { CropTimelineComponent } from './crop-timeline.component';
import { CropTimelineService } from './crop-timeline.service';
import { AuthService } from '../../core/auth/auth.service';

describe('CropTimelineComponent', () => {
  let component: CropTimelineComponent;
  let fixture: ComponentFixture<CropTimelineComponent>;
  let timelineService: CropTimelineService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const spyRouter = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    spyRouter.createUrlTree.and.returnValue({});
    spyRouter.serializeUrl.and.returnValue('');
    spyRouter.events = of();
    
    // Clear localStorage to isolate tests
    localStorage.removeItem('my_farm_crops');
    localStorage.removeItem('my_farm_crop_activities');
    localStorage.removeItem('my_farm_f-default_crops');
    localStorage.removeItem('my_farm_f-default_crop_activities');

    await TestBed.configureTestingModule({
      imports: [CropTimelineComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        CropTimelineService,
        { provide: Router, useValue: spyRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CropTimelineComponent);
    component = fixture.componentInstance;
    timelineService = TestBed.inject(CropTimelineService);
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Log in the default user so the service loads and seeds mock data
    const authService = TestBed.inject(AuthService);
    authService.login({
      id: 'f-default',
      fullName: 'Ram Jawade',
      phone: '9876543210',
      email: 'ram.jawade@myfarm.com',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Green Valley Farm',
      farmArea: 6.5,
      farmAreaUnit: 'hectares',
      primaryCrops: ['Soybeans', 'Wheat'],
      waterSource: 'Borewell',
      irrigationType: 'Drip',
      farmingMethod: 'Organic',
      locationType: 'map',
      location: { lat: 20.5937, lng: 78.9629 },
      createdAt: Date.now()
    });

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-seed and display default crops on init', () => {
    const seededCrops = timelineService.crops();
    expect(seededCrops.length).toBe(2);
    expect(seededCrops.find(c => c.name === 'Soybeans')).toBeTruthy();
    expect(seededCrops.find(c => c.name === 'Wheat')).toBeTruthy();

    // Verify default view is dashboard
    expect(component.currentView()).toBe('dashboard');
  });

  it('should calculate days after sowing correctly', () => {
    const today = new Date();
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(today.getDate() - 10);

    const days = component.getDaysAfterSowing(tenDaysAgo.getTime());
    expect(days).toBe(10);
  });

  it('should filter crops by search term dynamically', () => {
    // Both crops present originally
    expect(component.filteredCrops().length).toBe(2);

    // Filter for Soybean
    component.searchTerm.set('Soy');
    expect(component.filteredCrops().length).toBe(1);
    expect(component.filteredCrops()[0].name).toBe('Soybeans');

    // Filter for Field B
    component.searchTerm.set('Field B');
    expect(component.filteredCrops().length).toBe(1);
    expect(component.filteredCrops()[0].name).toBe('Wheat');

    // Filter with no matches
    component.searchTerm.set('Apples');
    expect(component.filteredCrops().length).toBe(0);
  });

  it('should allow adding a new crop and generate standard Sowing diary entry', () => {
    const initialCropsCount = timelineService.crops().length;

    // Fill form
    component.cropForm.patchValue({
      name: 'My Custom Rice Crop',
      cropType: 'Rice',
      fieldId: 'Field C',
      area: 3.2,
      areaUnit: 'hectares',
      sowingDate: '2026-05-15',
      currentStage: 'Sowing'
    });

    expect(component.cropForm.valid).toBeTrue();
    component.onSubmitCrop();

    // Verify crop added
    const crops = timelineService.crops();
    expect(crops.length).toBe(initialCropsCount + 1);
    const addedRice = crops.find(c => c.name === 'My Custom Rice Crop');
    expect(addedRice).toBeTruthy();
    expect(addedRice!.cropType).toBe('Rice');
    expect(addedRice!.fieldId).toBe('Field C');
    expect(addedRice!.area).toBe(3.2);

    // Verify 8 default stage activities are created (Land Preparation & Sowing completed, other 6 planned)
    const activities = timelineService.getActivitiesForCrop(addedRice!.id);
    expect(activities.length).toBe(8);
    expect(activities.filter(a => a.status === 'Completed').length).toBe(2);
    expect(activities.filter(a => a.status === 'Planned').length).toBe(6);
    expect(component.currentView()).toBe('dashboard'); // redirects back
  });

  it('should allow adding a new crop with empty sowing date and generate default activities with no dates', () => {
    const initialCropsCount = timelineService.crops().length;

    // Fill form with empty sowing date
    component.cropForm.patchValue({
      name: 'My Custom Corn Crop',
      cropType: 'Corn',
      fieldId: 'Field C',
      area: 2.5,
      areaUnit: 'hectares',
      sowingDate: '',
      currentStage: 'Sowing'
    });

    expect(component.cropForm.valid).toBeTrue();
    component.onSubmitCrop();

    // Verify crop added
    const crops = timelineService.crops();
    expect(crops.length).toBe(initialCropsCount + 1);
    const addedCorn = crops.find(c => c.name === 'My Custom Corn Crop')!;
    expect(addedCorn).toBeTruthy();
    expect(addedCorn.sowingDate).toBeUndefined();

    // Verify default stage activities have empty string date values
    const activities = timelineService.getActivitiesForCrop(addedCorn.id);
    expect(activities.length).toBe(8);
    expect(activities.filter(a => a.date === undefined).length).toBe(8);
  });

  it('should switch to timeline view and display chronological history upon crop selection', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;

    component.selectCrop(soy);
    expect(component.selectedCrop()).toEqual(soy);
    expect(component.currentView()).toBe('timeline');

    // Verify history and upcoming activities computed lists are loaded
    expect(component.cropActivities().length).toBeGreaterThan(0);
    expect(component.upcomingActivities().length).toBeGreaterThan(0);
  });

  it('should dynamically advance crop growth stage on click and record Field Inspection diary entry', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;
    component.selectCrop(soy);

    const initialStage = soy.currentStage;
    expect(initialStage).toBe('Flowering');

    // Click to advance stage to Maturity
    const initialActsCount = component.cropActivities().length;
    component.updateStage('Maturity');

    expect(component.selectedCrop()!.currentStage).toBe('Maturity');

    // Verify automated diary entry recorded
    const freshActs = component.cropActivities();
    expect(freshActs.length).toBe(initialActsCount + 1);
    expect(freshActs[0].type).toBe('Field Inspection');
    expect(freshActs[0].notes).toContain('Maturity');
  });

  it('should add, edit, and delete activities through forms', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;
    component.selectCrop(soy);

    const initialHistoryCount = component.cropActivities().length;
    const initialUpcomingCount = component.upcomingActivities().length;

    // 1. Add new Irrigation Activity
    component.openAddActivityModal();
    expect(component.showActivityModal()).toBeTrue();
    expect(component.editingActivity()).toBeNull();

    component.activityForm.patchValue({
      type: 'Irrigation',
      date: '2026-06-01',
      status: 'Completed',
      cost: 500,
      notes: 'Logged custom irrigation test',
      irrigationMethod: 'Sprinkler',
      duration: 60,
      waterQuantity: 2500
    });

    component.onSubmitActivity();
    expect(component.showActivityModal()).toBeFalse();
    expect(component.cropActivities().length).toBe(initialHistoryCount + 1);

    const freshIrr = component.cropActivities().find(a => a.type === 'Irrigation')!;
    expect(freshIrr.type).toBe('Irrigation');
    expect(freshIrr.cost).toBe(500);
    expect(freshIrr.metadata.irrigationMethod).toBe('Sprinkler');

    // 2. Edit existing Activity
    component.openEditActivityModal(freshIrr);
    expect(component.showActivityModal()).toBeTrue();
    expect(component.editingActivity()).toEqual(freshIrr);

    component.activityForm.patchValue({
      cost: 750,
      notes: 'Updated cost notes'
    });

    component.onSubmitActivity();
    expect(component.showActivityModal()).toBeFalse();
    
    const updatedIrr = component.cropActivities().find(a => a.id === freshIrr.id)!;
    expect(updatedIrr.cost).toBe(750);
    expect(updatedIrr.notes).toBe('Updated cost notes');

    // 3. Delete Activity
    component.onDeleteActivity(freshIrr.id);
    expect(component.showDeleteConfirm()).toBeTrue();
    expect(component.selectedActivityId()).toBe(freshIrr.id);
    component.confirmDeleteActivity();
    expect(component.cropActivities().length).toBe(initialHistoryCount); // back to initial
  });

  it('should filter out subactivities (parentActivityId set) from computed activities list', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;
    component.selectCrop(soy);

    // Verify subActivity exists in raw activities
    const allRawActs = timelineService.activities();
    const subAct = allRawActs.find(a => a.id === 'a-soy-1-sub1');
    expect(subAct).toBeTruthy();
    expect(subAct!.parentActivityId).toBe('a-soy-1');

    // Verify subActivity is NOT in cropActivities
    const cropActs = component.cropActivities();
    expect(cropActs.find(a => a.id === 'a-soy-1-sub1')).toBeFalsy();

    // Verify subActivity is NOT in upcomingActivities
    const upcomingActs = component.upcomingActivities();
    expect(upcomingActs.find(a => a.id === 'a-soy-1-sub1')).toBeFalsy();
  });

  it('should update stage, retrieve/create main activity, and open log activity modal with parentActivityId set when updateStage is called', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;
    component.selectCrop(soy);

    spyOn(component, 'openAddActivityModal').and.callThrough();

    // Call updateStage for Fruiting / Pod Formation
    component.updateStage('Fruiting / Pod Formation');

    // Assert stage is updated
    expect(component.selectedCrop()!.currentStage).toBe('Fruiting / Pod Formation');

    // Retrieve the newly created main activity
    const mainAct = component.findOrCreateMainActivityForStage('Fruiting / Pod Formation');
    expect(mainAct).toBeTruthy();
    expect(mainAct.notes).toContain('Fruiting / Pod Formation');

    // Assert modal was opened with the correct main activity ID
    expect(component.openAddActivityModal).toHaveBeenCalledWith(mainAct.id);
    expect(component.currentParentActivityId()).toBe(mainAct.id);
    expect(component.showActivityModal()).toBeTrue();
  });

  it('should show delete confirmation and delete the crop profile successfully', () => {
    const crops = timelineService.crops();
    const soy = crops.find(c => c.name === 'Soybeans')!;
    const initialCropsCount = crops.length;

    // Trigger onDeleteCrop
    component.onDeleteCrop(soy.id);
    expect(component.selectedCropIdToDelete()).toBe(soy.id);
    expect(component.showDeleteCropConfirm()).toBeTrue();

    // Confirm deletion
    component.confirmDeleteCrop();
    expect(timelineService.crops().length).toBe(initialCropsCount - 1);
    expect(timelineService.crops().find(c => c.id === soy.id)).toBeFalsy();
    expect(component.showDeleteCropConfirm()).toBeFalse();
    expect(component.selectedCrop()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/crops']);
  });
});
