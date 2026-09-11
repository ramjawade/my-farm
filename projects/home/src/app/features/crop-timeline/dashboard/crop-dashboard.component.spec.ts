import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { CropDashboardComponent } from './crop-dashboard.component';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity } from '../crop-timeline.models';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;
  let router: Router;

  const mockCrop: CropEntity = {
    id: 'c1',
    name: 'Soybeans',
    cropType: 'Soybeans',
    fieldId: 'Field A',
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
});
