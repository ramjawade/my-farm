import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CropTimelineDetailComponent } from './crop-timeline-detail.component';
import { CropEntity, ActivityEntity } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { FarmActivityService } from '../../farm-activity/farm-activity.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { of } from 'rxjs';

describe('CropTimelineDetailComponent', () => {
  let component: CropTimelineDetailComponent;
  let fixture: ComponentFixture<CropTimelineDetailComponent>;
  const fb = new FormBuilder();

  const mockCrop: CropEntity = {
    id: 'c1',
    name: 'Soybeans',
    cropType: 'Soybeans',
    fieldId: 'Field A',
    area: 10,
    areaUnit: 'hectares',
    sowingDate: Date.now(),
    currentStage: 'Flowering',
    status: 'Active'
  };

  const mockUpcoming: ActivityEntity[] = [];
  const mockActivities: ActivityEntity[] = [];

  beforeEach(async () => {
    const spyRouter = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    spyRouter.createUrlTree.and.returnValue({});
    spyRouter.serializeUrl.and.returnValue('');
    spyRouter.events = of();
    const mockActivatedRoute = {
      queryParams: of({}),
      snapshot: { queryParams: {} }
    };

    await TestBed.configureTestingModule({
      imports: [CropTimelineDetailComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: spyRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        CropTimelineService,
        FarmActivityService,
        FarmDrawService,
        AuthService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CropTimelineDetailComponent);
    component = fixture.componentInstance;
    
    // Assign inputs
    component.selectedCrop = mockCrop;
    component.stages = ['Land Preparation', 'Sowing', 'Germination', 'Vegetative Growth', 'Flowering'];
    component.upcomingActivities = mockUpcoming;
    component.cropActivities = mockActivities;
    component.showActivityModal = false;
    component.editingActivity = null;
    component.uploadedImages = [];
    component.activityForm = fb.group({
      type: ['Irrigation'],
      date: ['2026-05-31'],
      status: ['Completed'],
      cost: [0],
      notes: [''],
      irrigationMethod: ['Drip'],
      duration: [30],
      waterQuantity: [1000],
      fertilizerName: ['NPK 19-19-19'],
      fertilizerQuantity: [25],
      applicationMethod: ['Broadcasting'],
      chemicalName: ['Neem Oil'],
      dosage: ['500 ml/ha'],
      sprayWaterQuantity: [200],
      targetPest: ['Aphids'],
      yieldQuantity: [500],
      yieldUnit: ['kg'],
      grade: ['A'],
      sellingPrice: [40]
    });

    fixture.detectChanges();
  });

  it('should create the detail component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate days after sowing correctly', () => {
    const today = Date.now();
    expect(component.getDaysAfterSowing(today)).toBe(0);
  });

  it('should get stage index', () => {
    expect(component.getStageIndex('Flowering')).toBe(4);
  });

  it('should resolve activity icons and colors', () => {
    expect(component.getActivityIcon('Irrigation')).toBe('bi-droplet-half');
    expect(component.getActivityColor('Irrigation')).toBe('#3182ce');
    expect(component.getActivityEmoji('Irrigation')).toBe('💧');
  });

  it('should not update stage immediately when onUpdateStageClicked is called, but should set parentActivityIdForModal', () => {
    const timelineSvc = TestBed.inject(CropTimelineService);
    
    // Seed default activities for the mock crop
    timelineSvc.addCrop(mockCrop);
    
    const crop = timelineSvc.crops()[0];
    component.selectedCrop = crop;
    fixture.detectChanges();

    const initialStage = crop.currentStage;
    expect(initialStage).toBe('Flowering');

    // Click stage node 'Maturity' (index 6, which is Planned)
    component.onUpdateStageClicked('Maturity');
    fixture.detectChanges();

    // Verify crop stage is NOT advanced immediately
    const currentCrop = timelineSvc.crops().find(c => c.id === crop.id)!;
    expect(currentCrop.currentStage).toBe('Flowering');

    // Verify parentActivityIdForModal is set to the pre-created Maturity stage activity
    const maturityAct = timelineSvc.findMainActivityForStage(crop.id, 'Maturity')!;
    expect(maturityAct).toBeTruthy();
    expect(maturityAct.status).toBe('Planned');
    expect(component.parentActivityIdForModal()).toBe(maturityAct.id);

    // Simulate submitting a subactivity under this parent activity
    timelineSvc.addActivity({
      cropId: crop.id,
      type: 'Labour Activity',
      date: Date.now(),
      status: 'Completed',
      cost: 0,
      notes: 'Subactivity notes',
      attachments: [],
      metadata: {},
      parentActivityId: maturityAct.id
    });

    // Now verify parent activity is marked Completed and crop stage is advanced
    const updatedMaturityAct = timelineSvc.activities().find(a => a.id === maturityAct.id)!;
    expect(updatedMaturityAct.status).toBe('Completed');

    const updatedCrop = timelineSvc.crops().find(c => c.id === crop.id)!;
    expect(updatedCrop.currentStage).toBe('Maturity');
  });

  it('should open edit modal locally with correct activity details when onEditActivityClicked is called', () => {
    const mockActivity: ActivityEntity = {
      id: 'act-edit-1',
      cropId: 'c1',
      type: 'Irrigation',
      date: Date.now(),
      status: 'Planned',
      cost: 0,
      notes: 'Test irrigation notes',
      attachments: [],
      metadata: {},
      parentActivityId: 'a-parent-id'
    };

    component.onEditActivityClicked(mockActivity);
    
    expect(component.editingActivityIdForModal()).toBe('act-edit-1');
    expect(component.parentActivityIdForModal()).toBe('a-parent-id');
  });


});

