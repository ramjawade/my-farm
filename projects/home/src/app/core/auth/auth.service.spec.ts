import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';

describe('AuthService', () => {
  let service: AuthService;

  const mockFarmer: FarmerRegistrationData = {
    id: 'f-test-1',
    fullName: 'Test Farmer',
    phone: '9998887776',
    preferredLanguage: 'English',
    userRole: 'Farmer',
    farmName: 'Test Farm',
    farmArea: 1,
    farmAreaUnit: 'hectares',
    primaryCrops: [],
    waterSource: 'Rainfed',
    irrigationType: 'Manual',
    farmingMethod: 'Organic',
    locationType: 'skipped',
    location: null,
    createdAt: Date.now(),
    pinHash: 'somehash',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        AuthService,
        FarmerRegistrationService,
      ],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not be logged in by default', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should log in a farmer and persist session expiry', () => {
    service.login(mockFarmer);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.currentUser()?.id).toBe('f-test-1');
    expect(localStorage.getItem('my_farm_session_expiry')).toBeTruthy();
  });

  it('should consider a fresh session valid', () => {
    service.login(mockFarmer);
    expect(service.isSessionValid()).toBeTrue();
  });

  it('should invalidate an expired session', () => {
    service.login(mockFarmer);
    localStorage.setItem('my_farm_session_expiry', String(Date.now() - 1000));

    expect(service.isSessionValid()).toBeFalse();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should clear session on logout', () => {
    service.login(mockFarmer);
    service.logout();

    expect(service.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('my_farm_session_expiry')).toBeFalsy();
    expect(localStorage.getItem('my_farm_active_user_id')).toBeFalsy();
  });
});
