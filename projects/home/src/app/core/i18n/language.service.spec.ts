import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LANGUAGE_STORAGE_KEY } from './app-language';
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
  preferredLanguage: 'hi',
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
  let translate: TranslateService;

  function setup(): LanguageService {
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
    translate = TestBed.inject(TranslateService);
    spyOn(translate, 'use').and.returnValue(of({}));
    const service = TestBed.inject(LanguageService);
    TestBed.flushEffects();
    return service;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'mr';
  });

  it('defaults to Marathi on a device that never chose a language', () => {
    const service = setup();

    expect(service.language()).toBe('mr');
    expect(translate.use).toHaveBeenCalledWith('mr');
  });

  it('uses the language chosen on the device', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'hi');

    expect(setup().language()).toBe('hi');
  });

  it('falls back to Marathi for a stored value it does not support', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon');

    expect(setup().language()).toBe('mr');
  });

  it('lets the signed-in farmer language win over the device language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'mr');
    const service = setup();

    TestBed.inject(AuthService).login({ ...mockFarmer, preferredLanguage: 'en' });
    TestBed.flushEffects();

    expect(service.language()).toBe('en');
    expect(translate.use).toHaveBeenCalledWith('en');
  });

  it('ignores a profile language it does not support', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'hi');
    const service = setup();

    TestBed.inject(AuthService).login({ ...mockFarmer, preferredLanguage: 'English' });
    TestBed.flushEffects();

    expect(service.language()).toBe('hi');
  });

  it('remembers the farmer language on the device so the login page matches after sign-out', () => {
    setup();

    TestBed.inject(AuthService).login({ ...mockFarmer, preferredLanguage: 'en' });
    TestBed.flushEffects();

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('applies and saves a choice made on the device, and keeps the page lang in step', () => {
    const service = setup();
    const doc = TestBed.inject(DOCUMENT);
    expect(doc.documentElement.lang).toBe('mr');

    service.setDeviceLanguage('en');
    TestBed.flushEffects();

    expect(service.language()).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(translate.use).toHaveBeenCalledWith('en');
    expect(doc.documentElement.lang).toBe('en');
  });
});
