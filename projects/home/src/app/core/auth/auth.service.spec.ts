import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { HttpService } from '../http/http.service';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { IStorageService } from '../storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';

const mockFarmer: FarmerRegistrationData = {
  id: 1,
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: IStorageService, useClass: InMemoryStorageService },
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
    expect(service.currentUser()?.id).toBe(1);
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

/**
 * `HttpService` is a root singleton holding the bearer token, so an identity
 * that outlives its session is a cross-tenant read: the next farmer on this
 * browser would be authenticated as the previous one.
 */
describe('AuthService — API token lifecycle', () => {
  let service: AuthService;
  let httpService: HttpService;

  const otherFarmer: FarmerRegistrationData = { ...mockFarmer, id: 2 };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IStorageService, useClass: InMemoryStorageService },
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        AuthService,
        FarmerRegistrationService,
      ],
    });
    service = TestBed.inject(AuthService);
    httpService = TestBed.inject(HttpService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should hand a supplied token to HttpService', () => {
    const spy = spyOn(httpService, 'setAuthToken');
    service.login(mockFarmer, 'token-a');

    expect(spy).toHaveBeenCalledWith('token-a');
    expect(localStorage.getItem('my_farm_session_token')).toBe('token-a');
  });

  it('should clear the token on logout', () => {
    service.login(mockFarmer, 'token-a');
    const spy = spyOn(httpService, 'setAuthToken');
    service.logout();

    expect(spy).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });

  it('should not let a tokenless login inherit the previous farmer token', () => {
    service.login(mockFarmer, 'token-a');
    service.logout();

    // Farmer B signs in with a PIN — no Firebase token in play.
    const spy = spyOn(httpService, 'setAuthToken');
    service.login(otherFarmer);

    expect(spy).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });

  it('should rebind the token when a second farmer logs in with their own', () => {
    service.login(mockFarmer, 'token-a');
    const spy = spyOn(httpService, 'setAuthToken');
    service.login(otherFarmer, 'token-b');

    expect(spy).toHaveBeenCalledWith('token-b');
  });

  it('should clear the token when the session expires', () => {
    service.login(mockFarmer, 'token-a');
    const spy = spyOn(httpService, 'setAuthToken');
    localStorage.setItem('my_farm_session_expiry', String(Date.now() - 1000));

    expect(service.isSessionValid()).toBeFalse();
    expect(spy).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });
});
