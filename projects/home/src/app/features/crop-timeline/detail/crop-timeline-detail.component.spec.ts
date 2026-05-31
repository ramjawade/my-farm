import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CropTimelineDetailComponent } from './crop-timeline-detail.component';
import { CropEntity, ActivityEntity } from '../crop-timeline.models';

describe('CropTimelineDetailComponent', () => {
  let component: CropTimelineDetailComponent;
  let fixture: ComponentFixture<CropTimelineDetailComponent>;
  const fb = new FormBuilder();

  const mockCrop: CropEntity = {
    id: 'c1',
    name: 'Soybeans',
    fieldId: 'Field A',
    area: 10,
    areaUnit: 'hectares',
    sowingDate: new Date().toISOString(),
    currentStage: 'Flowering',
    status: 'Active'
  };

  const mockUpcoming: ActivityEntity[] = [];
  const mockActivities: ActivityEntity[] = [];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CropTimelineDetailComponent, ReactiveFormsModule],
      providers: [provideZonelessChangeDetection()]
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
    const todayStr = new Date().toISOString();
    expect(component.getDaysAfterSowing(todayStr)).toBe(0);
  });

  it('should get stage index', () => {
    expect(component.getStageIndex('Flowering')).toBe(4);
  });

  it('should resolve activity icons and colors', () => {
    expect(component.getActivityIcon('Irrigation')).toBe('bi-droplet-half');
    expect(component.getActivityColor('Irrigation')).toBe('#3182ce');
    expect(component.getActivityEmoji('Irrigation')).toBe('💧');
  });
});
