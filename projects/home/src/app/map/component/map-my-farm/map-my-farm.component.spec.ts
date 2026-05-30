import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MapMyFarmComponent } from './map-my-farm.component';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { FarmAreaResult } from '../../models/map.models';
import { signal } from '@angular/core';

describe('MapMyFarmComponent', () => {
  let mockFarmDraw: jasmine.SpyObj<FarmDrawService>;

  beforeEach(async () => {
    mockFarmDraw = jasmine.createSpyObj('FarmDrawService', [
      'startDrawing',
      'cancelDrawing',
      'undoLastPoint',
      'saveFarm'
    ]);

    // Setup mock signal states
    (mockFarmDraw as any).isDrawing = signal(false);
    (mockFarmDraw as any).isCompleted = signal(false);
    (mockFarmDraw as any).area = signal(null);
    (mockFarmDraw as any).pointCount = signal(0);

    await TestBed.configureTestingModule({
      imports: [MapMyFarmComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: FarmDrawService, useValue: mockFarmDraw }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should start drawing when toggleMapMyFarm is called and drawing is not active', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    (mockFarmDraw as any).isDrawing.set(false);
    (mockFarmDraw as any).isCompleted.set(false);

    component.toggleMapMyFarm();

    expect(mockFarmDraw.startDrawing).toHaveBeenCalled();
  });

  it('should cancel drawing when toggleMapMyFarm is called and drawing is active', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    (mockFarmDraw as any).isDrawing.set(true);

    component.toggleMapMyFarm();

    expect(mockFarmDraw.cancelDrawing).toHaveBeenCalled();
  });

  it('should trigger cancel drawing when cancel is called', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    component.cancel();
    expect(mockFarmDraw.cancelDrawing).toHaveBeenCalled();
  });

  it('should trigger undo point when undo is called', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    component.undo();
    expect(mockFarmDraw.undoLastPoint).toHaveBeenCalled();
  });

  it('should update farmName signal when name input event fires', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    component.onNameInput({ target: { value: 'Sky Farm' } } as any);
    expect(component.farmName()).toBe('Sky Farm');
  });

  it('should call saveFarm and clear farmName signal on save', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    component.farmName.set('Valley Farm');
    component.save();

    expect(mockFarmDraw.saveFarm).toHaveBeenCalledWith('Valley Farm');
    expect(component.farmName()).toBe('');
  });

  it('should return null formattedArea if service has no computed area', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    expect(component.formattedArea()).toBeNull();
  });

  it('should format farm area results correctly in computed property', () => {
    const fixture = TestBed.createComponent(MapMyFarmComponent);
    const component = fixture.componentInstance;

    const mockArea: FarmAreaResult = { squareMeters: 20000, hectares: 2.0, acres: 4.94 };
    (mockFarmDraw as any).area.set(mockArea);

    const formatted = component.formattedArea();
    expect(formatted).not.toBeNull();
    expect(formatted!.hectares).toBe('2.00');
    expect(formatted!.acres).toBe('4.94');
  });
});
