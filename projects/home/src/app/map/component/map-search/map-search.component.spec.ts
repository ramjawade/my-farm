import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MapSearchService } from './map-search.service';
import { MapSearchResult } from '../../models/map.models';
import { MapSearchComponent } from './map-search.component';

describe('MapSearchComponent', () => {
  let mockGeocoding: jasmine.SpyObj<MapSearchService>;

  const mockResults: MapSearchResult[] = [
    {
      id: '78.96,20.59-0',
      rank: 1,
      label: 'Main Farm Office',
      subtitle: 'office · 12345 · India',
      lat: 20.59,
      lon: 78.96
    }
  ];

  beforeEach(async () => {
    mockGeocoding = jasmine.createSpyObj('MapSearchService', ['search']);

    await TestBed.configureTestingModule({
      imports: [MapSearchComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MapSearchService, useValue: mockGeocoding }
      ]
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should not search if query length is less than 3 characters', (done) => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;

    mockGeocoding.search.and.returnValue(of(mockResults));

    component.onSearchInput({ target: { value: 'ab' } } as any);

    setTimeout(() => {
      expect(mockGeocoding.search).not.toHaveBeenCalled();
      expect(component.searchResults()).toEqual([]);
      done();
    }, 450);
  });

  it('should trigger search and store results when query is 3 or more characters', (done) => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;

    mockGeocoding.search.and.returnValue(of(mockResults));

    component.onSearchInput({ target: { value: 'farm' } } as any);

    setTimeout(() => {
      expect(mockGeocoding.search).toHaveBeenCalledWith('farm');
      expect(component.searchResults()).toEqual(mockResults);
      expect(component.searchLoading()).toBeFalse();
      done();
    }, 450);
  });

  it('should set error message if search fails', () => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;

    mockGeocoding.search.and.returnValue(throwError(() => new Error('API Error')));

    component.searchQuery.set('error');
    component.searchNow();

    expect(mockGeocoding.search).toHaveBeenCalledWith('error');
    expect(component.searchResults()).toEqual([]);
    expect(component.searchError()).toBe('Search failed. Try again.');
  });

  it('should emit resultSelected and close results when selecting a result', () => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;

    spyOn(component.resultSelected, 'emit');

    component.selectResult(mockResults[0]);

    expect(component.resultSelected.emit).toHaveBeenCalledWith(mockResults[0]);
    expect(component.searchQuery()).toBe(mockResults[0].label);
    expect(component.showResults()).toBeFalse();
  });

  it('should clear search input and results on clearSearch', () => {
    const fixture = TestBed.createComponent(MapSearchComponent);
    const component = fixture.componentInstance;

    spyOn(component.searchCleared, 'emit');
    component.searchQuery.set('some value');
    component.searchResults.set(mockResults);

    component.clearSearch();

    expect(component.searchQuery()).toBe('');
    expect(component.searchResults()).toEqual([]);
    expect(component.searchCleared.emit).toHaveBeenCalled();
  });
});
