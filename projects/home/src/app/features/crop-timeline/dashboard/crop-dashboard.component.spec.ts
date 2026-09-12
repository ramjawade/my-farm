import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { CropDashboardComponent } from './crop-dashboard.component';
import { CropDashboardService } from './crop-dashboard.service';
import { CropEntity } from '../crop-timeline.models';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;
  let router: Router;
  let getCropsSpy: jasmine.Spy;

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
    getCropsSpy = jasmine.createSpy('getCrops').and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [CropDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        // ActivityService (injected by the component directly) still goes
        // through IStorageService — only CropDashboardService is mocked here.
        { provide: IStorageService, useClass: InMemoryStorageService },
        { provide: CropDashboardService, useValue: { getCrops: getCropsSpy } },
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
    getCropsSpy.and.resolveTo([mockCrop]);
    await component.load();
    component.onSearchTermChange('no-such-crop');
    fixture.detectChanges();

    expect(component.hasNoCropsAtAll()).toBeFalse();
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('No crop profiles match your search');
  });

  it('shows an error state with a retry when loading crops fails', async () => {
    getCropsSpy.and.rejectWith(new Error('network down'));
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBe('Could not load your crops. Please try again.');
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('Try again');

    getCropsSpy.and.resolveTo([mockCrop]);
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBeNull();
    expect(component.crops().length).toBe(1);
  });
});
