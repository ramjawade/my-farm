import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MapSearchService, MAP_SEARCH_RESULT_LIMIT } from './map-search.service';

describe('MapSearchService', () => {
  let service: MapSearchService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MapSearchService,
        provideZonelessChangeDetection()
      ]
    });
    service = TestBed.inject(MapSearchService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should search query and format photon response correctly', () => {
    const mockPhotonResponse = {
      features: [
        {
          geometry: { coordinates: [78.96, 20.59] as [number, number] },
          properties: {
            name: 'Central Farm',
            city: 'Nagpur',
            state: 'Maharashtra',
            country: 'India',
            type: 'farm'
          }
        }
      ]
    };

    service.search('Nagpur').subscribe((results) => {
      expect(results.length).toBe(1);
      expect(results[0].label).toBe('Central Farm');
      expect(results[0].subtitle).toBe('farm · India');
      expect(results[0].lat).toBe(20.59);
      expect(results[0].lon).toBe(78.96);
      expect(results[0].id).toBe('78.96,20.59-0');
      expect(results[0].rank).toBe(1);
    });

    const req = httpTestingController.expectOne(
      'https://photon.komoot.io/api/?q=Nagpur&limit=' + MAP_SEARCH_RESULT_LIMIT + '&lang=en'
    );
    expect(req.request.method).toEqual('GET');
    req.flush(mockPhotonResponse);
  });
});
