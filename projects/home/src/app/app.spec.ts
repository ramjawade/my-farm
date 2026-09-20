import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ActivitiesApiService } from './core/api/activities-api.service';
import { FakeActivitiesApiService } from './testing/fake-activities-api.service';
import { CropsApiService } from './core/api/crops-api.service';
import { FakeCropsApiService } from './testing/fake-crops-api.service';
import { LandsApiService } from './core/api/lands-api.service';
import { FakeLandsApiService } from './testing/fake-lands-api.service';
import { FarmerProfileApiService } from './core/api/farmer-profile-api.service';
import { FakeFarmerProfileApiService } from './testing/fake-farmer-profile-api.service';
import { WeatherApiService } from './core/api/weather-api.service';
import { FakeWeatherApiService } from './testing/fake-weather-api.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
        { provide: CropsApiService, useClass: FakeCropsApiService },
        { provide: LandsApiService, useClass: FakeLandsApiService },
        { provide: FarmerProfileApiService, useClass: FakeFarmerProfileApiService },
        { provide: WeatherApiService, useClass: FakeWeatherApiService },
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app layout', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-layout')).toBeTruthy();
  });
});
