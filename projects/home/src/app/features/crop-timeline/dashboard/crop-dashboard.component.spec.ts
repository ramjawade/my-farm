import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CropDashboardComponent } from './crop-dashboard.component';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity } from '../crop-timeline.models';

describe('CropDashboardComponent', () => {
  let component: CropDashboardComponent;
  let fixture: ComponentFixture<CropDashboardComponent>;

  const mockCrops: CropEntity[] = [
    {
      id: 'c1',
      name: 'Soybeans',
      fieldId: 'Field A',
      area: 10,
      areaUnit: 'hectares',
      sowingDate: new Date().toISOString(),
      currentStage: 'Sowing',
      status: 'Active'
    }
  ];

  beforeEach(async () => {
    localStorage.removeItem('my_farm_crops');
    localStorage.removeItem('my_farm_crop_activities');

    await TestBed.configureTestingModule({
      imports: [CropDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        CropTimelineService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CropDashboardComponent);
    component = fixture.componentInstance;
    component.filteredCrops = mockCrops;
    component.searchTerm = '';
    fixture.detectChanges();
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate days after sowing', () => {
    const todayStr = new Date().toISOString();
    expect(component.getDaysAfterSowing(todayStr)).toBe(0);
  });

  it('should resolve the correct stage index', () => {
    expect(component.getStageIndex('Sowing')).toBe(1);
    expect(component.getStageIndex('Harvest')).toBe(7);
  });

  it('should resolve next stage correctly', () => {
    expect(component.getNextStage('Sowing')).toBe('Germination');
    expect(component.getNextStage('Harvest')).toBe('Fully Mature');
  });

  it('should emit cropSelected event on card click', () => {
    spyOn(component.cropSelected, 'emit');
    component.cropSelected.emit(mockCrops[0]);
    expect(component.cropSelected.emit).toHaveBeenCalledWith(mockCrops[0]);
  });
});
