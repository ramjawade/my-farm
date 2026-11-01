import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { WeatherComponent } from './weather.component';
import { BannerService } from '../../core/banners/banner.service';
import { AuthService } from '../../core/auth/auth.service';
import { WeatherService } from '../../core/weather/weather.service';
import { IWeatherService } from '../../core/weather/weather.interface';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { LandsApiService } from '../../core/api/lands-api.service';
import { FakeLandsApiService } from '../../testing/fake-lands-api.service';

describe('WeatherComponent', () => {
  let component: WeatherComponent;
  let fixture: ComponentFixture<WeatherComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WeatherComponent],
      providers: [
        { provide: LandsApiService, useClass: FakeLandsApiService },
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'weather', children: [] }]),
        provideHttpClient(),
        provideTranslateService(),
        AuthService,
        WeatherService,
        { provide: IWeatherService, useClass: WeatherService },
      ],
    }).compileComponents();

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
      id: 1,
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
      createdAt: Date.now(),
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showLocationPrompt()).toBeTrue();
  });

  it('should hide location prompt if village/state is configured', () => {
    const mockUser: FarmerRegistrationData = {
      id: 1,
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
      createdAt: Date.now(),
    };
    authService.login(mockUser);
    fixture.detectChanges();

    expect(component.showLocationPrompt()).toBeFalse();
  });

  it('shows the sample-data banner on Weather while the forecast is demo data', async () => {
    const banners = TestBed.inject(BannerService);
    expect(component.isDemoData()).toBeTrue();

    await TestBed.inject(Router).navigateByUrl('/weather');

    expect(banners.active().map((b) => b.id)).toContain('weather-sample');
  });

  it('removes the sample-data banner when the page is destroyed', async () => {
    const banners = TestBed.inject(BannerService);
    await TestBed.inject(Router).navigateByUrl('/weather');

    fixture.destroy();

    expect(banners.active().map((b) => b.id)).not.toContain('weather-sample');
  });

  it('should set showEditDialog to true when openLandDialog is called', () => {
    expect(component.showEditDialog()).toBeFalse();
    component.openLandDialog();
    expect(component.showEditDialog()).toBeTrue();
  });
});
