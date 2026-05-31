import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { FarmerRegistrationComponent } from './farmer-registration.component';
import { FarmerRegistrationService } from './farmer-registration.service';

describe('FarmerRegistrationComponent', () => {
  let component: FarmerRegistrationComponent;
  let fixture: ComponentFixture<FarmerRegistrationComponent>;
  let registrationService: FarmerRegistrationService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const spyRouter = jasmine.createSpyObj('Router', ['navigate']);
    
    // Clear localStorage to isolate tests
    localStorage.removeItem('my_farm_registered_farmers');

    await TestBed.configureTestingModule({
      imports: [FarmerRegistrationComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        FarmerRegistrationService,
        { provide: Router, useValue: spyRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FarmerRegistrationComponent);
    component = fixture.componentInstance;
    registrationService = TestBed.inject(FarmerRegistrationService);
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize on step 1 with default values', () => {
    expect(component.currentStep()).toBe(1);
    expect(component.isSuccess()).toBeFalse();
    expect(component.selectedCrops().length).toBe(0);
    expect(component.latitude()).toBeNull();
    expect(component.longitude()).toBeNull();

    const form = component.registrationForm;
    expect(form.get('preferredLanguage')?.value).toBe('English');
    expect(form.get('userRole')?.value).toBe('Farmer');
    expect(form.get('farmAreaUnit')?.value).toBe('hectares');
    expect(form.get('waterSource')?.value).toBe('Rainfed');
    expect(form.get('irrigationType')?.value).toBe('Drip');
    expect(form.get('farmingMethod')?.value).toBe('Organic');
  });

  it('should validate step 1 and allow navigation to step 2', () => {
    expect(component.isStep1Valid()).toBeFalse();
    
    // Set invalid inputs
    component.registrationForm.patchValue({
      fullName: 'Ab', // short
      phone: '123'    // invalid pattern
    });
    expect(component.isStep1Valid()).toBeFalse();

    // Set valid inputs
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210'
    });
    expect(component.isStep1Valid()).toBeTrue();

    // Navigate to step 2
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('should validate step 2 and allow navigation to step 3', () => {
    // Fill step 1 first
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210'
    });
    component.nextStep(); // to step 2

    // Make step 2 invalid by clearing a required step 2 control
    component.registrationForm.get('userRole')?.setValue('');
    expect(component.isStep2Valid()).toBeFalse();

    // Restore valid step 2
    component.registrationForm.get('userRole')?.setValue('Farmer');
    expect(component.isStep2Valid()).toBeTrue();

    // Navigate to step 3
    component.nextStep();
    expect(component.currentStep()).toBe(3);
  });

  it('should validate step 3 location mapping only when coordinates are pinned', () => {
    // Step 3 area is required for step 3 to be valid
    component.registrationForm.patchValue({
      farmArea: 5.0
    });
    
    expect(component.isStep3Valid()).toBeFalse();

    // Set coordinates
    component.latitude.set(23.4567);
    component.longitude.set(75.6789);
    expect(component.isStep3Valid()).toBeTrue(); // now valid
  });

  it('should only update farmArea in draw mode and not in pin mode', () => {
    // 1. In 'pin' mode (default), completed drawing state should NOT update farmArea
    component.setMapMode('pin');
    component.registrationForm.get('farmArea')?.setValue(10);
    component.drawService.status.set('completed');
    component.drawService.area.set({ squareMeters: 50000, hectares: 5.0, acres: 12.35 });
    
    fixture.detectChanges();
    
    expect(component.registrationForm.get('farmArea')?.value).toBe(10); // Remains unchanged

    // 2. Switch to 'draw' mode, completing drawing state SHOULD update farmArea
    component.setMapMode('draw');
    component.drawService.status.set('completed');
    component.drawService.area.set({ squareMeters: 50000, hectares: 5.0, acres: 12.35 });
    
    fixture.detectChanges();
    
    expect(component.registrationForm.get('farmArea')?.value).toBe(5.0); // Automatically updated to 5 hectares!
  });

  it('should validate step 4 crops selection only when at least one crop is selected', () => {
    expect(component.isStep4Valid()).toBeFalse();

    // Select a crop
    component.toggleCrop('Wheat');
    expect(component.selectedCrops()).toEqual(['Wheat']);
    expect(component.isStep4Valid()).toBeTrue(); // now valid

    // Toggling crop again should remove it
    component.toggleCrop('Wheat');
    expect(component.selectedCrops().length).toBe(0);
    expect(component.isStep4Valid()).toBeFalse(); // invalid again since crops are empty
  });

  it('should submit registration and save data on successful submit', () => {
    // Fill all form steps
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      email: 'amit@patelfarms.com',
      preferredLanguage: 'Hindi',
      userRole: 'Agronomist',
      farmName: 'Saraswati Orchards',
      farmArea: 12.5,
      farmAreaUnit: 'hectares',
      waterSource: 'Canal',
      irrigationType: 'Drip',
      farmingMethod: 'Organic'
    });

    component.toggleCrop('Wheat');
    component.toggleCrop('Fruits');
    component.latitude.set(23.4567);
    component.longitude.set(75.6789);

    expect(component.registrationForm.valid).toBeTrue();
    expect(component.isStep3Valid()).toBeTrue();
    expect(component.isStep4Valid()).toBeTrue();

    // Submit
    component.submitRegistration();

    expect(component.isSuccess()).toBeTrue();
    expect(component.registeredName()).toBe('Amit Patel');

    // Verify service storage
    const farmers = registrationService.registeredFarmers();
    expect(farmers.length).toBe(1);
    expect(farmers[0].fullName).toBe('Amit Patel');
    expect(farmers[0].phone).toBe('9876543210');
    expect(farmers[0].userRole).toBe('Agronomist');
    expect(farmers[0].farmName).toBe('Saraswati Orchards');
    expect(farmers[0].location).toEqual({ lat: 23.4567, lng: 75.6789 });
  });

  it('should reset form and map when calling resetForm', () => {
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      farmName: 'Saraswati Orchards',
      farmArea: 12.5
    });
    component.toggleCrop('Wheat');
    component.latitude.set(23.4567);
    component.longitude.set(75.6789);

    component.resetForm();

    expect(component.currentStep()).toBe(1);
    expect(component.isSuccess()).toBeFalse();
    expect(component.selectedCrops().length).toBe(0);
    expect(component.latitude()).toBeNull();
    expect(component.longitude()).toBeNull();
    expect(component.registrationForm.get('fullName')?.value).toBeNull();
  });

  it('should validate step 3 manually when using manual village selection and submit correctly', () => {
    // Fill steps 1 and 2
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      farmName: 'Saraswati Orchards',
      farmArea: 12.5
    });
    component.goToStep(3);

    expect(component.isStep3Valid()).toBeFalse();

    // Toggle location method to manual
    component.setLocationMethod('manual');
    expect(component.locationMethod()).toBe('manual');
    expect(component.isStep3Valid()).toBeFalse(); // no manual inputs

    // Fill manual village details
    component.registrationForm.patchValue({
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Pimpalgaon',
      pincode: '422209'
    });
    expect(component.isStep3Valid()).toBeTrue(); // now location is valid!

    // Go to step 4 (Crops)
    component.goToStep(4);
    expect(component.isStep4Valid()).toBeFalse(); // no crops selected yet

    // Add crops
    component.toggleCrop('Wheat');
    expect(component.isStep4Valid()).toBeTrue(); // crops are now valid!

    // Verify submission builds correct manual structure
    component.goToStep(5);
    component.submitRegistration();

    expect(component.isSuccess()).toBeTrue();
    const farmers = registrationService.registeredFarmers();
    expect(farmers.length).toBe(1);
    expect(farmers[0].locationType).toBe('manual');
    expect(farmers[0].state).toBe('Maharashtra');
    expect(farmers[0].district).toBe('Nashik');
    expect(farmers[0].village).toBe('Pimpalgaon');
    expect(farmers[0].pincode).toBe('422209');
    expect(farmers[0].location).toBeNull();
  });

  it('should allow skipping step 3 via skipStep3 and submit with skipped status', () => {
    // Fill steps 1 and 2
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      farmName: 'Saraswati Orchards',
      farmArea: 12.5
    });
    component.goToStep(3);

    expect(component.isStep3Valid()).toBeFalse();

    // Call skipStep3
    component.skipStep3();
    expect(component.isStep3Skipped()).toBeTrue();
    expect(component.currentStep()).toBe(5); // goes to step 5 review
    expect(component.isStep3Valid()).toBeTrue(); // bypassed validation!

    // Verify submission builds correct skipped structure
    component.submitRegistration();

    expect(component.isSuccess()).toBeTrue();
    const farmers = registrationService.registeredFarmers();
    expect(farmers.length).toBe(1);
    expect(farmers[0].locationType).toBe('skipped');
    expect(farmers[0].primaryCrops).toEqual([]);
    expect(farmers[0].waterSource).toBe('Skipped');
    expect(farmers[0].irrigationType).toBe('Skipped');
    expect(farmers[0].farmingMethod).toBe('Skipped');
    expect(farmers[0].location).toBeNull();
  });

  it('should reset the map view to the center of India when resetMapView is called', () => {
    const map = (component as any).map;
    expect(map).toBeTruthy();
    const setViewSpy = spyOn(map, 'setView').and.callThrough();
    component.resetMapView();
    expect(setViewSpy).toHaveBeenCalledWith([20.5937, 78.9629], 5);
  });
});
