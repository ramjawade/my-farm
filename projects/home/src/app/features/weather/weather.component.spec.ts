import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { WeatherComponent } from './weather.component';
import { AuthService } from '../../core/auth/auth.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';

describe('WeatherComponent', () => {
  let component: WeatherComponent;
  let fixture: ComponentFixture<WeatherComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WeatherComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        AuthService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show location prompt if village/state is not configured', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
      fullName: 'Test Farmer',
      phone: '1234567890',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Test Farm',
      farmArea: 2.0,
      farmAreaUnit: 'hectares',
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'skipped',
      location: null,
      createdAt: Date.now()
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showLocationPrompt()).toBeTrue();
  });

  it('should hide location prompt if village/state is configured', () => {
    const mockUser: FarmerRegistrationData = {
      id: 'f-test',
      fullName: 'Test Farmer',
      phone: '1234567890',
      preferredLanguage: 'English',
      userRole: 'Farmer',
      farmName: 'Test Farm',
      farmArea: 2.0,
      farmAreaUnit: 'hectares',
      primaryCrops: [],
      waterSource: 'Rainfed',
      irrigationType: 'Manual',
      farmingMethod: 'Organic',
      locationType: 'manual',
      village: 'Pune',
      state: 'Maharashtra',
      location: null,
      createdAt: Date.now()
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showLocationPrompt()).toBeFalse();
  });

  it('should set showEditDialog to true when openLandDialog is called', () => {
    expect(component.showEditDialog()).toBeFalse();
    component.openLandDialog();
    expect(component.showEditDialog()).toBeTrue();
  });
});
