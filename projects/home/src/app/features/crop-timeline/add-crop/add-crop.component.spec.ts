import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AddCropComponent } from './add-crop.component';

describe('AddCropComponent', () => {
  let component: AddCropComponent;
  let fixture: ComponentFixture<AddCropComponent>;
  const fb = new FormBuilder();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCropComponent, ReactiveFormsModule],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(AddCropComponent);
    component = fixture.componentInstance;
    
    // Assign inputs
    component.cropNameOptions = ['Soybeans', 'Wheat'];
    component.stages = ['Land Preparation', 'Sowing'];
    component.cropForm = fb.group({
      name: ['Soybeans', Validators.required],
      fieldId: ['', Validators.required],
      area: [10, [Validators.required, Validators.min(1)]],
      areaUnit: ['hectares'],
      sowingDate: ['2026-05-31'],
      currentStage: ['Sowing']
    });

    fixture.detectChanges();
  });

  it('should create the add-crop component', () => {
    expect(component).toBeTruthy();
  });

  it('should validate form and emit submitCrop on submit', () => {
    spyOn(component.submitCrop, 'emit');
    
    // Invalid initially (fieldId empty)
    component.onSubmit();
    expect(component.submitCrop.emit).not.toHaveBeenCalled();

    // Fill form to make it valid
    component.cropForm.patchValue({ fieldId: 'Field C' });
    fixture.detectChanges();

    component.onSubmit();
    expect(component.submitCrop.emit).toHaveBeenCalled();
  });

  it('should emit cancelClicked event on cancel click', () => {
    spyOn(component.cancelClicked, 'emit');
    component.cancelClicked.emit();
    expect(component.cancelClicked.emit).toHaveBeenCalled();
  });
});
