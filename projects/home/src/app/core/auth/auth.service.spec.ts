import { TestBed } from '@angular/core/testing';
import { Injectable, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { IStorageService } from '../storage/storage.interface';
import { LocalStorageService } from '../storage/local-storage.service';

/**
 * A storage implementation that carries an API credential, like
 * `ApiStorageService` does. `LocalStorageService` has no token API, so the
 * token paths are invisible to it.
 */
@Injectable()
class TokenAwareLocalStorageService extends LocalStorageService {
  authToken: string | null = null;

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }
}

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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: IStorageService, useClass: LocalStorageService },
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

/**
 * The API storage service is a root singleton holding the bearer token, so an
 * identity that outlives its session is a cross-tenant read: the next farmer
 * on this browser would be authenticated as the previous one.
 */
describe('AuthService — API token lifecycle', () => {
  let service: AuthService;
  let storage: TokenAwareLocalStorageService;

  const otherFarmer: FarmerRegistrationData = { ...mockFarmer, id: 'f-test-2' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IStorageService, useClass: TokenAwareLocalStorageService },
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        AuthService,
        FarmerRegistrationService,
      ],
    });
    service = TestBed.inject(AuthService);
    storage = TestBed.inject(IStorageService) as TokenAwareLocalStorageService;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should hand a supplied token to the storage service', () => {
    service.login(mockFarmer, 'token-a');

    expect(storage.authToken).toBe('token-a');
    expect(localStorage.getItem('my_farm_session_token')).toBe('token-a');
  });

  it('should clear the token on logout', () => {
    service.login(mockFarmer, 'token-a');
    service.logout();

    expect(storage.authToken).toBeNull();
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });

  it('should not let a tokenless login inherit the previous farmer token', () => {
    service.login(mockFarmer, 'token-a');
    service.logout();

    // Farmer B signs in with a PIN — no Firebase token in play.
    service.login(otherFarmer);

    expect(storage.authToken).toBeNull();
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });

  it('should rebind the token when a second farmer logs in with their own', () => {
    service.login(mockFarmer, 'token-a');
    service.login(otherFarmer, 'token-b');

    expect(storage.authToken).toBe('token-b');
  });

  it('should clear the token when the session expires', () => {
    service.login(mockFarmer, 'token-a');
    localStorage.setItem('my_farm_session_expiry', String(Date.now() - 1000));

    expect(service.isSessionValid()).toBeFalse();
    expect(storage.authToken).toBeNull();
    expect(localStorage.getItem('my_farm_session_token')).toBeFalsy();
  });
});
