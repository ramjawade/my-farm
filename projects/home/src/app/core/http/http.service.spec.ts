import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoaderService, ToastService } from 'shared';
import { HttpService } from './http.service';

describe('HttpService', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let loader: LoaderService;

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
    toast = TestBed.inject(ToastService);
    loader = TestBed.inject(LoaderService);
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

  it('shows an error toast and rethrows on a 5xx response', async () => {
    spyOn(toast, 'error');
    const promise = service.get('/lands');
    const req = httpMock.expectOne('/api/v1/lands');
    req.flush('timeout', { status: 504, statusText: 'Gateway Timeout' });

    await expectAsync(promise).toBeRejected();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and rethrows on a network error', async () => {
    spyOn(toast, 'error');
    const promise = service.get('/lands');
    const req = httpMock.expectOne('/api/v1/lands');
    req.error(new ProgressEvent('error'));

    await expectAsync(promise).toBeRejected();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('does not toast on an ordinary 404/401 -- callers already handle those', async () => {
    spyOn(toast, 'error');
    const promise = service.get('/lands');
    const req = httpMock.expectOne('/api/v1/lands');
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejected();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the app-wide loader for the duration of a request, and hides it once settled', async () => {
    expect(loader.isLoading()).toBeFalse();
    const promise = service.get('/lands');
    expect(loader.isLoading()).toBeTrue();

    const req = httpMock.expectOne('/api/v1/lands');
    req.flush({ items: [] });
    await promise;

    expect(loader.isLoading()).toBeFalse();
  });

  it('keeps the loader shown while a second overlapping request is still in flight', async () => {
    const firstPromise = service.get('/lands');
    const firstReq = httpMock.expectOne('/api/v1/lands');
    const secondPromise = service.get('/crops');
    const secondReq = httpMock.expectOne('/api/v1/crops');

    firstReq.flush({ items: [] });
    await firstPromise;
    expect(loader.isLoading()).toBeTrue();

    secondReq.flush({ items: [] });
    await secondPromise;
    expect(loader.isLoading()).toBeFalse();
  });

  it('hides the loader even when the request fails', async () => {
    const promise = service.get('/lands');
    expect(loader.isLoading()).toBeTrue();

    const req = httpMock.expectOne('/api/v1/lands');
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejected();
    expect(loader.isLoading()).toBeFalse();
  });
});
