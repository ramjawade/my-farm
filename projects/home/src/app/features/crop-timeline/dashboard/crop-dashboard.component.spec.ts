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
import { CropTimelineService } from '../crop-timeline.service';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;
  let router: Router;
  let getCropsSpy: jasmine.Spy;
  let loadFarmsSpy: jasmine.Spy;
  let deleteCropSpy: jasmine.Spy;

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
    deleteCropSpy = jasmine.createSpy('deleteCrop');

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
        { provide: CropTimelineService, useValue: { deleteCrop: deleteCropSpy } },
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

      expect(fixture.nativeElement.textContent).toContain('North Plot');
      expect(component.landName(7)).toBe('North Plot');
    });

    it('omits the badge for a land that no longer exists instead of printing its id', async () => {
      await showCrops([]);

      expect(component.landName(7)).toBe('');
      expect(fixture.nativeElement.textContent).not.toContain('7');
      expect(fixture.nativeElement.textContent).toContain('–');
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

  describe('crop cards', () => {
    const cards = () => Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.card'));

    async function showOne(): Promise<void> {
      loadFarmsSpy.and.resolveTo([{ id: 7, name: 'North Plot', points: [] }]);
      getCropsSpy.and.resolveTo([
        { ...mockCrop, sowingDate: Date.now() - 12 * 86_400_000, currentStage: 'Flowering' },
      ]);
      await component.load();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('shows plot, age, area and a four-step stage bar', async () => {
      await showOne();
      const text = cards()[0].textContent ?? '';
      expect(text).toContain('North Plot');
      expect(text).toContain('cropDashboard.daysCount');
      expect(text).toContain('10');
      expect(cards()[0].querySelector('app-stage-bar')).not.toBeNull();
      expect(component.age({ ...mockCrop, sowingDate: Date.now() - 12 * 86_400_000 })).toBe(12);
    });

    it('opens the detail when the card is selected', async () => {
      await showOne();
      spyOn(router, 'navigate');
      cards()[0].querySelector<HTMLButtonElement>('button')!.click();
      expect(router.navigate).toHaveBeenCalledWith(['/crops', mockCrop.id]);
    });

    it('opens the edit form from the actions menu', async () => {
      await showOne();
      spyOn(router, 'navigate');
      cards()[0].querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
      fixture.detectChanges();
      fixture.nativeElement.querySelector('[role="menuitem"]').click();
      expect(router.navigate).toHaveBeenCalledWith(['/crops', mockCrop.id, 'edit']);
    });

    it('asks before deleting, then removes the crop and its card', async () => {
      await showOne();
      component.onDeleteCrop(mockCrop);
      expect(component.showDeleteConfirm()).toBeTrue();
      expect(deleteCropSpy).not.toHaveBeenCalled();
      component.confirmDelete();
      fixture.detectChanges();
      expect(deleteCropSpy).toHaveBeenCalledWith(mockCrop.id);
      expect(component.crops().length).toBe(0);
    });

    it('does not delete when the confirmation is cancelled', async () => {
      await showOne();
      component.onDeleteCrop(mockCrop);
      component.showDeleteConfirm.set(false);
      expect(deleteCropSpy).not.toHaveBeenCalled();
      expect(component.crops().length).toBe(1);
    });

    it('shows the empty state with Add crop when there are no crops', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    });
  });
});
