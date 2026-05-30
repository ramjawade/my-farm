import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SavedFarmsComponent } from './saved-farms.component';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { FarmAreaResult, SavedFarm } from '../../models/map.models';
import { signal } from '@angular/core';

describe('SavedFarmsComponent', () => {
  let mockFarmDraw: jasmine.SpyObj<FarmDrawService>;

  const mockFarms: SavedFarm[] = [
    {
      id: 'farm-1',
      name: 'Central Pasture',
      points: [{ lat: 10, lng: 10 }, { lat: 11, lng: 11 }, { lat: 10, lng: 11 }],
      area: { squareMeters: 10000, hectares: 1.0, acres: 2.47 },
      geoJson: {} as any,
      createdAt: Date.now()
    }
  ];

  beforeEach(async () => {
    mockFarmDraw = jasmine.createSpyObj('FarmDrawService', ['deleteFarm', 'selectFarm']);
    // Setup mock signal states
    (mockFarmDraw as any).savedFarms = signal(mockFarms);
    (mockFarmDraw as any).selectedSavedFarm = signal(null);

    await TestBed.configureTestingModule({
      imports: [SavedFarmsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: FarmDrawService, useValue: mockFarmDraw }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SavedFarmsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should toggle collapse state of saved farms list', () => {
    const fixture = TestBed.createComponent(SavedFarmsComponent);
    const component = fixture.componentInstance;

    expect(component.savedFarmsCollapsed()).toBeFalse();
    component.toggleSavedFarmsCollapse();
    expect(component.savedFarmsCollapsed()).toBeTrue();
  });

  it('should format farm area result string correctly', () => {
    const fixture = TestBed.createComponent(SavedFarmsComponent);
    const component = fixture.componentInstance;

    const mockArea: FarmAreaResult = { squareMeters: 5000, hectares: 0.5, acres: 1.235 };
    const formatted = component.formatFarmArea(mockArea);

    expect(formatted).toBe('0.50 ha (1.24 ac)');
  });

  it('should call deleteFarm service method when deleting a farm', () => {
    const fixture = TestBed.createComponent(SavedFarmsComponent);
    const component = fixture.componentInstance;

    const clickEvent = new MouseEvent('click');
    spyOn(clickEvent, 'stopPropagation');

    component.onDeleteSavedFarm(clickEvent, 'farm-1');

    expect(clickEvent.stopPropagation).toHaveBeenCalled();
    expect(mockFarmDraw.deleteFarm).toHaveBeenCalledWith('farm-1');
  });
});
