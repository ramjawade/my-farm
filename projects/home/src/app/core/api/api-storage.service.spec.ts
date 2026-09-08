import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApiStorageService } from './api-storage.service';
import { flushPromises } from '../../testing/flush-promises';

describe('ApiStorageService', () => {
  let service: ApiStorageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiStorageService,
      ],
    });
    service = TestBed.inject(ApiStorageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('auth token', () => {
    it('should omit the Authorization header when no token is set', async () => {
      const promise = service.getCrops('u1');

      const req = httpMock.expectOne('/api/v1/crops');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [], cursor: null });

      await promise;
    });

    it('should send the bearer token once set', async () => {
      service.setAuthToken('token-a');
      const promise = service.getCrops('u1');

      const req = httpMock.expectOne('/api/v1/crops');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-a');
      req.flush({ items: [], cursor: null });

      await promise;
    });

    it('should stop sending the token after clearAuthToken', async () => {
      service.setAuthToken('token-a');
      service.clearAuthToken();
      const promise = service.getCrops('u1');

      const req = httpMock.expectOne('/api/v1/crops');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [], cursor: null });

      await promise;
    });
  });

  describe('cursor pagination', () => {
    it('should follow the cursor across pages and return every record', async () => {
      const promise = service.getFarms('u1');

      const first = httpMock.expectOne('/api/v1/lands');
      first.flush({
        items: [{ id: 'l1', name: 'Plot 1' }],
        cursor: 'c1',
      });
      await flushPromises();

      const second = httpMock.expectOne('/api/v1/lands?cursor=c1');
      second.flush({
        items: [{ id: 'l2', name: 'Plot 2' }],
        cursor: null,
      });

      const farms = await promise;
      expect(farms.map((f) => f.id)).toEqual(['l1', 'l2']);
    });

    it('should accept next_cursor as well as cursor', async () => {
      const promise = service.getActivities('u1');

      const first = httpMock.expectOne('/api/v1/activities');
      first.flush({ items: [{ id: 'a1' }], next_cursor: 'c1' });
      await flushPromises();

      const second = httpMock.expectOne('/api/v1/activities?cursor=c1');
      second.flush({ items: [{ id: 'a2' }], next_cursor: null });

      const activities = await promise;
      expect(activities.map((a) => a.id)).toEqual(['a1', 'a2']);
    });

    it('should stop when the server repeats a cursor', async () => {
      const promise = service.getCrops('u1');

      const first = httpMock.expectOne('/api/v1/crops');
      first.flush({ items: [{ id: 'c1' }], cursor: 'same' });
      await flushPromises();

      const second = httpMock.expectOne('/api/v1/crops?cursor=same');
      second.flush({ items: [{ id: 'c2' }], cursor: 'same' });

      const crops = await promise;
      expect(crops.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('should url-encode the cursor', async () => {
      const promise = service.getCrops('u1');

      const first = httpMock.expectOne('/api/v1/crops');
      first.flush({ items: [], cursor: 'a b&c' });
      await flushPromises();

      const second = httpMock.expectOne((r) => r.url === '/api/v1/crops');
      expect(second.request.params.get('cursor')).toBe('a b&c');
      second.flush({ items: [], cursor: null });

      await promise;
    });
  });
});
