import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CropTimelineComponent } from './crop-timeline.component';
import { CropTimelineService } from './crop-timeline.service';

describe('CropTimelineComponent', () => {
  let component: CropTimelineComponent;
  let fixture: ComponentFixture<CropTimelineComponent>;
  let timelineService: CropTimelineService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const spyRouter = jasmine.createSpyObj('Router', ['navigate']);
    
    // Clear localStorage to isolate tests
    localStorage.removeItem('my_farm_crops');
    localStorage.removeItem('my_farm_crop_activities');

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

    const days = component.getDaysAfterSowing(tenDaysAgo.toISOString());
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
      name: 'Rice',
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
    const addedRice = crops.find(c => c.name === 'Rice');
    expect(addedRice).toBeTruthy();
    expect(addedRice!.fieldId).toBe('Field C');
    expect(addedRice!.area).toBe(3.2);

    // Verify Sowing diary entry auto-created
    const activities = timelineService.getActivitiesForCrop(addedRice!.id);
    expect(activities.length).toBe(1);
    expect(activities[0].type).toBe('Sowing');
    expect(component.currentView()).toBe('dashboard'); // redirects back
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

    const freshIrr = component.cropActivities()[0];
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
});
