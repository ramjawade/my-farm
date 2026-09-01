import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FarmDrawService } from './farm-draw.service';
import { LatLngPoint, SavedFarm } from '../models/map.models';

describe('FarmDrawService', () => {
  let service: FarmDrawService;

  const mockPoints: LatLngPoint[] = [
    { lat: 10, lng: 20 },
    { lat: 10, lng: 21 },
    { lat: 11, lng: 21 },
    { lat: 11, lng: 20 }
  ];

  beforeEach(() => {
    spyOn(localStorage, 'getItem').and.returnValue(null);
    spyOn(localStorage, 'setItem');

    TestBed.configureTestingModule({
      providers: [
        FarmDrawService,
        provideZonelessChangeDetection()
      ]
    });
    service = TestBed.inject(FarmDrawService);
  });

  it('should be created with initial idle status', () => {
    expect(service).toBeTruthy();
    expect(service.status()).toBe('idle');
    expect(service.points()).toEqual([]);
    expect(service.area()).toBeNull();
    expect(service.savedFarms()).toEqual([]);
    expect(service.selectedSavedFarm()).toBeNull();
  });

  it('should start drawing and clear current state', () => {
    service.status.set('completed');
    service.points.set(mockPoints);
    service.selectedSavedFarm.set({} as SavedFarm);

    service.startDrawing();

    expect(service.status()).toBe('drawing');
    expect(service.points()).toEqual([]);
    expect(service.area()).toBeNull();
    expect(service.selectedSavedFarm()).toBeNull();
  });

  it('should add points during drawing status', () => {
    service.status.set('drawing');
    service.addPoint({ lat: 5, lng: 5 });
    expect(service.points()).toEqual([{ lat: 5, lng: 5 }]);

    service.addPoint({ lat: 10, lng: 10 });
    expect(service.points().length).toBe(2);
  });

  it('should not add points when not in drawing status', () => {
    service.status.set('idle');
    service.addPoint({ lat: 5, lng: 5 });
    expect(service.points()).toEqual([]);
  });

  it('should undo last point during drawing status', () => {
    service.status.set('drawing');
    service.points.set(mockPoints);

    service.undoLastPoint();
    expect(service.points().length).toBe(mockPoints.length - 1);
    expect(service.points()[service.points().length - 1]).toEqual({ lat: 11, lng: 21 });
  });

  it('should finish drawing when having at least 3 points', () => {
    service.status.set('drawing');
    service.points.set(mockPoints);

    service.finishDrawing();

    expect(service.status()).toBe('completed');
    expect(service.area()).not.toBeNull();
    expect(service.area()?.hectares).toBeGreaterThan(0);
  });

  it('should cancel drawing and reset state', () => {
    service.status.set('drawing');
    service.points.set(mockPoints);

    service.cancelDrawing();

    expect(service.status()).toBe('idle');
    expect(service.points()).toEqual([]);
    expect(service.area()).toBeNull();
  });

  it('should save completed farm drawing', () => {
    service.status.set('completed');
    service.points.set(mockPoints);
    service.finishDrawing(); // Calculate area

    const initialSavedCount = service.savedFarms().length;
    service.saveFarm('Green Acres');

    expect(service.savedFarms().length).toBe(initialSavedCount + 1);
    expect(service.savedFarms()[0].name).toBe('Green Acres');
    expect(service.selectedSavedFarm()).toEqual(service.savedFarms()[0]);
    expect(service.status()).toBe('idle'); // Automatically resets on save
  });

  it('should delete a saved farm', () => {
    const mockFarm: SavedFarm = {
      id: 'farm-123',
      name: 'Old Farm',
      points: mockPoints,
      area: { squareMeters: 125000, hectares: 12.5, acres: 30.8 },
      geoJson: {} as any,
      createdAt: Date.now()
    };
    service.savedFarms.set([mockFarm]);
    service.selectedSavedFarm.set(mockFarm);

    service.deleteFarm('farm-123');

    expect(service.savedFarms().length).toBe(0);
    expect(service.selectedSavedFarm()).toBeNull();
  });

  it('should select saved farm and trigger zoomRequest$', (done) => {
    const mockFarm: SavedFarm = {
      id: 'farm-456',
      name: 'Cozy Farm',
      points: mockPoints,
      area: { squareMeters: 55000, hectares: 5.5, acres: 13.5 },
      geoJson: {} as any,
      createdAt: Date.now()
    };

    service.zoomRequest$.subscribe((requested) => {
      expect(requested).toEqual(mockFarm);
      done();
    });

    service.selectFarm(mockFarm);

    expect(service.selectedSavedFarm()).toEqual(mockFarm);
    expect(service.status()).toBe('idle'); // Selecting farm cancels active drawing
  });
});
