import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SavedFarmsComponent } from './saved-farms.component';
import { FarmAreaResult, SavedFarm } from '../../models/map.models';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';

describe('SavedFarmsComponent', () => {
  const mockFarms: SavedFarm[] = [
    {
      id: 1,
      name: 'Central Pasture',
      points: [
        { lat: 10, lng: 10 },
        { lat: 11, lng: 11 },
        { lat: 10, lng: 11 },
      ],
      area: { squareMeters: 10000, hectares: 1.0, acres: 2.47 },
      geoJson: {} as any,
      createdAt: Date.now(),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedFarmsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(SavedFarmsComponent);
    fixture.componentRef.setInput('farms', mockFarms);
    fixture.componentRef.setInput('selected', null);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should toggle collapse state of saved farms list', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.savedFarmsCollapsed()).toBeFalse();
    component.toggleSavedFarmsCollapse();
    expect(component.savedFarmsCollapsed()).toBeTrue();
  });

  it('should format farm area result string correctly', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    const mockArea: FarmAreaResult = { squareMeters: 5000, hectares: 0.5, acres: 1.235 };
    const formatted = component.formatFarmArea(mockArea);

    expect(formatted).toBe('0.50 ha (1.24 ac)');
  });

  it('should emit deleteFarm when deleting a farm is confirmed', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    const emitted: number[] = [];
    component.deleteFarm.subscribe((id) => emitted.push(id));

    const clickEvent = new MouseEvent('click');
    spyOn(clickEvent, 'stopPropagation');

    component.onDeleteSavedFarm(clickEvent, 1);
    // Deletion is now behind a confirm dialog — simulate the user confirming.
    component.confirmDelete();

    expect(clickEvent.stopPropagation).toHaveBeenCalled();
    expect(emitted).toEqual([1]);
  });
});
