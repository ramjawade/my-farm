import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { FarmerRegistrationComponent } from './farmer-registration.component';
import { FarmerRegistrationService } from './farmer-registration.service';
import { AuthService } from '../../core/auth/auth.service';

describe('FarmerRegistrationComponent', () => {
  let component: FarmerRegistrationComponent;
  let fixture: ComponentFixture<FarmerRegistrationComponent>;
  let registrationService: FarmerRegistrationService;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    // Clear localStorage to isolate tests
    localStorage.removeItem('my_farm_registered_farmers');

    await TestBed.configureTestingModule({
      imports: [FarmerRegistrationComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        FarmerRegistrationService,
        AuthService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FarmerRegistrationComponent);
    component = fixture.componentInstance;
    registrationService = TestBed.inject(FarmerRegistrationService);
    registrationService.clearAll(); // Clean slate
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.isSuccess()).toBeFalse();
    const form = component.registrationForm;
    expect(form.get('preferredLanguage')?.value).toBe('English');
    expect(form.get('fullName')?.value).toBe('');
    expect(form.get('phone')?.value).toBe('');
  });

  it('should validate form fields correctly', () => {
    const form = component.registrationForm;
    expect(form.valid).toBeFalse();

    form.patchValue({
      fullName: 'Ab', // too short
      phone: '123'    // invalid phone pattern
    });
    expect(form.valid).toBeFalse();

    form.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210'
    });
    expect(form.valid).toBeTrue();
  });

  it('should submit registration and save data on successful submit', () => {
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      email: 'amit@patelfarms.com',
      preferredLanguage: 'Hindi'
    });

    expect(component.registrationForm.valid).toBeTrue();

    // Submit
    component.submitRegistration();

    expect(component.isSuccess()).toBeTrue();
    expect(component.registeredName()).toBe('Amit Patel');

    // Verify service storage
    const farmers = registrationService.registeredFarmers();
    expect(farmers.length).toBe(1);
    expect(farmers[0].fullName).toBe('Amit Patel');
    expect(farmers[0].phone).toBe('9876543210');
    expect(farmers[0].preferredLanguage).toBe('Hindi');

    // Verify logged in
    expect(authService.isLoggedIn()).toBeTrue();
    expect(authService.currentUser()?.fullName).toBe('Amit Patel');
  });

  it('should navigate to map on navigateToMap', () => {
    component.navigateToMap();
    expect(router.navigate).toHaveBeenCalledWith(['/map']);
  });
});
