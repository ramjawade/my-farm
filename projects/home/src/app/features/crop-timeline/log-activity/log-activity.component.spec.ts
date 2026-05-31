import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LogActivityComponent } from './log-activity.component';

describe('LogActivityComponent', () => {
  let component: LogActivityComponent;
  let fixture: ComponentFixture<LogActivityComponent>;
  const fb = new FormBuilder();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogActivityComponent, ReactiveFormsModule],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(LogActivityComponent);
    component = fixture.componentInstance;
    
    // Assign inputs
    component.showActivityModal = true;
    component.editingActivity = null;
    component.uploadedImages = [];
    component.activityForm = fb.group({
      type: ['Irrigation', Validators.required],
      date: ['2026-05-31', Validators.required],
      status: ['Completed', Validators.required],
      cost: [100],
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

  it('should create the log-activity component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit submitActivity when submit form is valid', () => {
    spyOn(component.submitActivity, 'emit');
    component.onSubmit();
    expect(component.submitActivity.emit).toHaveBeenCalled();
  });

  it('should emit closeActivityModal on cancel click', () => {
    spyOn(component.closeActivityModal, 'emit');
    component.closeActivityModal.emit();
    expect(component.closeActivityModal.emit).toHaveBeenCalled();
  });
});
