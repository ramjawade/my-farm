import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LanguageService } from './language.service';
import { AuthService } from '../auth/auth.service';
import { FarmerRegistrationData } from '../../features/farmer-registration/farmer-registration.models';
import { FarmerRegistrationService } from '../../features/farmer-registration/farmer-registration.service';
import { FarmerProfileApiService } from '../api/farmer-profile-api.service';
import { FakeFarmerProfileApiService } from '../../testing/fake-farmer-profile-api.service';

const mockFarmer: FarmerRegistrationData = {
  id: 1,
  fullName: 'Test Farmer',
  phone: '9998887776',
  preferredLanguage: 'mr',
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

describe('LanguageService', () => {
  let authService: AuthService;
  let translate: TranslateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: FarmerProfileApiService, useClass: FakeFarmerProfileApiService },
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        AuthService,
        FarmerRegistrationService,
      ],
    });
    authService = TestBed.inject(AuthService);
    translate = TestBed.inject(TranslateService);
    spyOn(translate, 'use').and.returnValue(of({}));
    TestBed.inject(LanguageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('switches the active locale when a farmer with a preferredLanguage logs in', () => {
    authService.login(mockFarmer);
    TestBed.flushEffects();

    expect(translate.use).toHaveBeenCalledWith('mr');
  });

  it('does not call use() while no farmer is logged in', () => {
    TestBed.flushEffects();

    expect(translate.use).not.toHaveBeenCalled();
  });
});
