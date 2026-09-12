import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { CropDashboardComponent } from './crop-dashboard.component';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity } from '../crop-timeline.models';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmerRegistrationData } from '../../farmer-registration/farmer-registration.models';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;
  let router: Router;

  const mockCrop: CropEntity = {
    id: 1,
    name: 'Soybeans',
    cropType: 'Soybeans',
    fieldId: 7,
    area: 10,
    areaUnit: 'hectares',
    sowingDate: Date.now(),
    currentStage: 'Sowing',
    status: 'Active',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CropDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        CropTimelineService,
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CropDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate days after sowing', () => {
    const today = Date.now();
    expect(component.getDaysAfterSowing(today)).toBe(0);
  });

  it('should resolve the correct stage index', () => {
    expect(component.getStageIndex('Sowing')).toBe(1);
    expect(component.getStageIndex('Harvest')).toBe(7);
  });

  it('should resolve next stage correctly', () => {
    expect(component.getNextStage('Sowing')).toBe('Germination');
    expect(component.getNextStage('Harvest')).toBe('Fully Mature');
  });

  it('should navigate to crop detail on card click', () => {
    spyOn(router, 'navigate');
    component.onCropSelected(mockCrop);
    expect(router.navigate).toHaveBeenCalledWith(['/crops', mockCrop.id]);
  });

  it('treats a brand-new account (zero crops) as the true empty state, not a search miss', () => {
    expect(component.hasNoCropsAtAll()).toBeTrue();
    fixture.detectChanges();
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain("You haven't added any crops yet");
    expect(html).not.toContain('match your search');
  });

  it('still shows the search-specific empty state when crops exist but none match', async () => {
    const storage = TestBed.inject(IStorageService);
    const timelineService = TestBed.inject(CropTimelineService);
    const authService = TestBed.inject(AuthService);
    // reload() is a no-op without a signed-in user (see crop-timeline.service.ts).
    const mockUser: FarmerRegistrationData = {
      id: 1,
      fullName: 'Test Farmer',
      phone: '1234567890',
      preferredLanguage: 'en',
      userRole: 'farmer',
      farmName: 'Test Farm',
      farmArea: 2,
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
    await storage.saveCrop(mockUser.id, {
      name: mockCrop.name,
      cropType: mockCrop.cropType,
      fieldId: mockCrop.fieldId,
      area: mockCrop.area,
      areaUnit: mockCrop.areaUnit,
      currentStage: mockCrop.currentStage,
      status: mockCrop.status,
    });
    await timelineService.reload();
    component.onSearchTermChange('no-such-crop');
    fixture.detectChanges();

    expect(component.hasNoCropsAtAll()).toBeFalse();
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('No crop profiles match your search');
  });
});
