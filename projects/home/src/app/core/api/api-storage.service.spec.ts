import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

  // `getFarms` (lands) is the one list endpoint whose mapper does no
  // reference-data lookups, so it exercises pagination and the auth header
  // without also having to stub crop/activity/expense-category resolution.

  describe('auth token', () => {
    it('should omit the Authorization header when no token is set', () => {
      const promise = service.getFarms('u1');

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [], cursor: null, has_more: false });

      return promise;
    });

    it('should send the bearer token once set', () => {
      service.setAuthToken('token-a');
      const promise = service.getFarms('u1');

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-a');
      req.flush({ items: [], cursor: null, has_more: false });

      return promise;
    });

    it('should stop sending the token once set back to null', () => {
      service.setAuthToken('token-a');
      service.setAuthToken(null);
      const promise = service.getFarms('u1');

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [], cursor: null, has_more: false });

      return promise;
    });
  });

  describe('cursor pagination', () => {
    it('should follow the cursor across pages and return every record', async () => {
      const promise = service.getFarms('u1');

      const first = httpMock.expectOne((r) => r.url === '/api/v1/lands' && !r.params.has('cursor'));
      expect(first.request.params.get('limit')).toBe('100');
      first.flush({
        items: [{ id: 'l1', name: 'Plot 1', created_at: '2024-01-01T00:00:00Z' }],
        cursor: 'c1',
        has_more: true,
      });
      await flushPromises();

      const second = httpMock.match(
        (r) => r.url === '/api/v1/lands' && r.params.get('cursor') === 'c1',
      );
      expect(second.length).toBe(1);
      second[0].flush({
        items: [{ id: 'l2', name: 'Plot 2', created_at: '2024-01-02T00:00:00Z' }],
        cursor: null,
        has_more: false,
      });

      const farms = await promise;
      expect(farms.map((f) => f.id)).toEqual(['l1', 'l2']);
    });

    it('should stop once has_more is false even if a cursor value is present', async () => {
      const promise = service.getFarms('u1');

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      req.flush({
        items: [{ id: 'l1', name: 'Plot 1', created_at: '2024-01-01T00:00:00Z' }],
        // A server that (incorrectly) echoes a cursor after the last page
        // must not cause another request — has_more is the source of truth.
        cursor: 'stale',
        has_more: false,
      });

      const farms = await promise;
      expect(farms.map((f) => f.id)).toEqual(['l1']);
    });
  });
});
