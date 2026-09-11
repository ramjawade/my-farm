import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiStorageService } from './api-storage.service';
import { HttpService } from '../http/http.service';
import { flushPromises } from '../../testing/flush-promises';

describe('ApiStorageService', () => {
  let service: ApiStorageService;
  let httpService: HttpService;
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
    httpService = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // `getFarms` (lands) is the one list endpoint whose mapper does no
  // reference-data lookups, so it exercises the request shape and the auth
  // header without also having to stub crop/activity/expense-category resolution.

  describe('auth token', () => {
    it('should omit the Authorization header when no token is set', () => {
      const promise = service.getFarms(1);

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [] });

      return promise;
    });

    it('should send the bearer token once set', () => {
      httpService.setAuthToken('token-a');
      const promise = service.getFarms(1);

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-a');
      req.flush({ items: [] });

      return promise;
    });

    it('should stop sending the token once set back to null', () => {
      httpService.setAuthToken('token-a');
      httpService.setAuthToken(null);
      const promise = service.getFarms(1);

      const req = httpMock.expectOne((r) => r.url === '/api/v1/lands');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ items: [] });

      return promise;
    });
  });

  describe('list endpoints', () => {
    it('getFarms makes a single unpaginated GET and returns every item (#61)', async () => {
      const promise = service.getFarms(1);

      const reqs = httpMock.match((r) => r.url === '/api/v1/lands');
      expect(reqs.length).toBe(1);
      expect(reqs[0].request.params.has('cursor')).toBeFalse();
      reqs[0].flush({
        items: [
          { id: 11, name: 'Plot 1', created_at: '2024-01-01T00:00:00Z' },
          { id: 12, name: 'Plot 2', created_at: '2024-01-02T00:00:00Z' },
        ],
      });

      const farms = await promise;
      expect(farms.map((f) => f.id)).toEqual([11, 12]);
    });
  });

  describe('create payloads', () => {
    it('saveFarm POSTs without an id and adopts the server-minted one', async () => {
      const promise = service.saveFarm(1, {
        name: 'Plot 1',
        points: [],
        area: { squareMeters: 100, hectares: 0.01, acres: 0.0247 },
        geoJson: null,
      });

      await flushPromises();
      httpMock
        .expectOne((r) => r.method === 'GET' && r.url === '/api/v1/farms')
        .flush({ items: [{ id: 5 }] });
      await flushPromises();

      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/lands');
      expect('id' in req.request.body).toBeFalse();
      expect(req.request.body.farm_id).toBe(5);
      req.flush({ id: 42, name: 'Plot 1', area_sq_m: 100, created_at: '2026-01-01T00:00:00Z' });

      const saved = await promise;
      expect(saved.id).toBe(42);
    });
  });

  describe('farmer profile', () => {
    it('saveFarmer PATCHes /me with the backend-owned fields only', async () => {
      httpService.setAuthToken('token-a');
      const promise = service.saveFarmer({
        id: 1,
        fullName: 'Asha Rao',
        phone: '9876500000',
        email: 'asha@example.com',
        preferredLanguage: 'hi',
        userRole: 'Farmer',
        farmName: "Asha's Farm",
        farmArea: 3,
        farmAreaUnit: 'acres',
        primaryCrops: ['Rice'],
        waterSource: 'Well',
        irrigationType: 'Drip',
        farmingMethod: 'Organic',
        locationType: 'skipped',
        location: null,
        createdAt: 0,
      });

      // saveFarmer runs through the serialized write queue, so the request
      // is issued on a microtask rather than synchronously.
      await flushPromises();

      const req = httpMock.expectOne('/api/v1/me');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        full_name: 'Asha Rao',
        email: 'asha@example.com',
        preferred_language: 'hi',
      });
      req.flush({
        id: 1,
        auth_uid: 'pin:1',
        user_role: 'farmer',
        full_name: 'Asha Rao',
        email: 'asha@example.com',
        preferred_language: 'hi',
        phone: '9876500000',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      });

      const saved = await promise;
      expect(saved.fullName).toBe('Asha Rao');
      expect(saved.preferredLanguage).toBe('hi');
    });

    it('getFarmerByPhone is a no-op on the API path (sign-in is one online call)', async () => {
      const found = await service.getFarmerByPhone('9876500000');
      expect(found).toBeUndefined();
      httpMock.expectNone(() => true);
    });
  });
});
