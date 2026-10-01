import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { CropDashboardComponent } from './crop-dashboard.component';
import { CropDashboardService } from './crop-dashboard.service';
import { CropEntity } from '../crop-timeline.models';
import { ActivitiesApiService } from '../../../core/api/activities-api.service';
import { FakeActivitiesApiService } from '../../../testing/fake-activities-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;
  let router: Router;
  let getCropsSpy: jasmine.Spy;
  let loadFarmsSpy: jasmine.Spy;

  const mockCrop: CropEntity = {
    id: 1,
    name: 'Soybeans',
    cropCatalogId: 1,
    fieldId: 7,
    area: 10,
    areaUnit: 'hectares',
    sowingDate: Date.now(),
    currentStage: 'Sowing',
    status: 'Active',
  };

  beforeEach(async () => {
    getCropsSpy = jasmine.createSpy('getCrops').and.resolveTo([]);
    loadFarmsSpy = jasmine.createSpy('loadFarms').and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [CropDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        // ActivityService (injected by the component directly) still goes
        // through ActivitiesApiService — only CropDashboardService is mocked here.
        { provide: ActivitiesApiService, useClass: FakeActivitiesApiService },
        { provide: CropDashboardService, useValue: { getCrops: getCropsSpy } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 1 }) } },
        { provide: FarmDrawService, useValue: { loadFarms: loadFarmsSpy } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CropDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
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
    expect(component.getNextStage('Harvest')).toBe('cropDashboard.fullyMature');
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
    expect(html).toContain('cropDashboard.noCropsYet');
    expect(html).not.toContain('cropDashboard.noMatchTitle');
  });

  it('still shows the search-specific empty state when crops exist but none match', async () => {
    getCropsSpy.and.resolveTo([mockCrop]);
    await component.load();
    component.onSearchTermChange('no-such-crop');
    fixture.detectChanges();

    expect(component.hasNoCropsAtAll()).toBeFalse();
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('cropDashboard.noMatchTitle');
  });

  it('shows an error state with a retry when loading crops fails', async () => {
    getCropsSpy.and.rejectWith(new Error('network down'));
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBe('cropDashboard.loadError');
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('cropDashboard.tryAgain');

    getCropsSpy.and.resolveTo([mockCrop]);
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(component.crops().length).toBe(1);
  });

  describe('land badge', () => {
    const northPlot = { id: 7, name: 'North Plot', points: [] };

    async function showCrops(farms: unknown[], crops: CropEntity[] = [mockCrop]): Promise<void> {
      loadFarmsSpy.and.resolveTo(farms);
      getCropsSpy.and.resolveTo(crops);
      await component.load();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    it('shows the land name, never the numeric land id', async () => {
      await showCrops([northPlot]);

      const badge = fixture.nativeElement.querySelector('.bi-pin-map-fill')?.parentElement;
      expect(badge?.textContent?.trim()).toBe('North Plot');
      expect(component.landName(7)).toBe('North Plot');
    });

    it('omits the badge for a land that no longer exists instead of printing its id', async () => {
      await showCrops([]);

      expect(component.landName(7)).toBe('');
      expect(fixture.nativeElement.querySelector('.bi-pin-map-fill')).toBeNull();
    });

    it('finds crops by land name when searching', async () => {
      await showCrops([northPlot], [mockCrop, { ...mockCrop, id: 2, name: 'Wheat', fieldId: 8 }]);

      component.onSearchTermChange('north');

      expect(component.filteredCrops().map((c) => c.id)).toEqual([1]);
    });

    it('does not match a crop by the digits of its land id', async () => {
      await showCrops([northPlot]);

      component.onSearchTermChange('7');

      expect(component.filteredCrops()).toEqual([]);
    });
  });
});
