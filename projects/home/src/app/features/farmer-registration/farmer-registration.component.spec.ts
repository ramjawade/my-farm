import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { FarmerRegistrationComponent } from './farmer-registration.component';
import { FarmerRegistrationService } from './farmer-registration.service';
import { AuthService } from '../../core/auth/auth.service';
import { IStorageService } from '../../core/storage/storage.interface';
import { LocalStorageService } from '../../core/storage/local-storage.service';

describe('FarmerRegistrationComponent', () => {
  let component: FarmerRegistrationComponent;
  let fixture: ComponentFixture<FarmerRegistrationComponent>;
  let registrationService: FarmerRegistrationService;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    localStorage.removeItem('my_farm_registered_farmers');

    await TestBed.configureTestingModule({
      imports: [FarmerRegistrationComponent, ReactiveFormsModule],
      providers: [
        { provide: IStorageService, useClass: LocalStorageService },
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        FarmerRegistrationService,
        AuthService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FarmerRegistrationComponent);
    component = fixture.componentInstance;
    registrationService = TestBed.inject(FarmerRegistrationService);
    await registrationService.ready;
    registrationService.clearAll();
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
      fullName: 'Ab',
      phone: '123',
    });
    expect(form.valid).toBeFalse();

    form.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      pin: '1234',
      confirmPin: '1234',
    });
    expect(form.valid).toBeTrue();
  });

  it('should flag mismatched pins as invalid', () => {
    const form = component.registrationForm;
    form.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      pin: '1234',
      confirmPin: '4321',
    });
    expect(form.valid).toBeFalse();
    expect(form.errors?.['pinMismatch']).toBeTrue();
  });

  it('should submit registration and save data on successful submit', async () => {
    component.registrationForm.patchValue({
      fullName: 'Amit Patel',
      phone: '9876543210',
      email: 'amit@patelfarms.com',
      preferredLanguage: 'Hindi',
      pin: '1234',
      confirmPin: '1234',
    });

    expect(component.registrationForm.valid).toBeTrue();

    await component.submitRegistration();

    expect(component.isSuccess()).toBeTrue();
    expect(component.registeredName()).toBe('Amit Patel');

    const farmers = registrationService.registeredFarmers();
    expect(farmers.length).toBe(1);
    expect(farmers[0].fullName).toBe('Amit Patel');
    expect(farmers[0].phone).toBe('9876543210');
    expect(farmers[0].preferredLanguage).toBe('Hindi');
    expect(farmers[0].pinHash).toBeTruthy();

    expect(authService.isLoggedIn()).toBeTrue();
    expect(authService.currentUser()?.fullName).toBe('Amit Patel');
  });

  it('should navigate to map on navigateToMap', () => {
    component.navigateToMap();
    expect(router.navigate).toHaveBeenCalledWith(['/map']);
  });
});
