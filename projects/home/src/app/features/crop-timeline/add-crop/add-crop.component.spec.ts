import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AddCropComponent } from './add-crop.component';
import { CropTimelineService } from '../crop-timeline.service';
import { AuthService } from '../../../core/auth/auth.service';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';

describe('AddCropComponent', () => {
  let component: AddCropComponent;
  let fixture: ComponentFixture<AddCropComponent>;
  const fb = new FormBuilder();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCropComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        CropTimelineService,
        AuthService,
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddCropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the add-crop component', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit if form is invalid', () => {
    const cropService = TestBed.inject(CropTimelineService);
    spyOn(cropService, 'addCrop');

    // Invalid initially (name and fieldId empty)
    component.onSubmit();
    expect(cropService.addCrop).not.toHaveBeenCalled();
  });

  it('should call addCrop with CROP_STAGES[0] as currentStage on submit', async () => {
    const cropService = TestBed.inject(CropTimelineService);
    spyOn(cropService, 'addCrop').and.resolveTo({ id: 1, name: 'Test Crop' } as any);
    const navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    // Fill form to make it valid
    component.cropForm.patchValue({
      name: 'My Soy Crop',
      fieldId: 7,
      area: '10',
      areaUnit: 'hectares',
      sowingDate: '2026-09-12',
    });
    fixture.detectChanges();

    await component.onSubmit();
    expect(cropService.addCrop).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'My Soy Crop',
        currentStage: 'Land Preparation',
      }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/crops']);
  });
});
