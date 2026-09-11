import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpService } from './http.service';

describe('HttpService', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpService,
      ],
    });
    service = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('prefixes relative paths with the configured API base URL', () => {
    const promise = service.get('/lands');

    const req = httpMock.expectOne('/api/v1/lands');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });

    return promise;
  });

  it('omits the Authorization header when no token is set', () => {
    const promise = service.get('/lands');

    const req = httpMock.expectOne('/api/v1/lands');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ items: [] });

    return promise;
  });

  it('sends the bearer token once set, and stops once cleared', () => {
    service.setAuthToken('token-a');
    let promise = service.get('/lands');
    let req = httpMock.expectOne('/api/v1/lands');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-a');
    req.flush({ items: [] });

    service.setAuthToken(null);
    promise = service.get('/lands');
    req = httpMock.expectOne('/api/v1/lands');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ items: [] });

    return promise;
  });

  it('sends post/patch/delete to the same base URL', async () => {
    const postPromise = service.post('/crops', { name: 'Rice' });
    const postReq = httpMock.expectOne('/api/v1/crops');
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ id: 'c1' });
    await postPromise;

    const patchPromise = service.patch('/crops/c1', { name: 'Wheat' });
    const patchReq = httpMock.expectOne('/api/v1/crops/c1');
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({});
    await patchPromise;

    const deletePromise = service.delete('/crops/c1');
    const deleteReq = httpMock.expectOne('/api/v1/crops/c1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({});
    await deletePromise;
  });
});
