import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpService } from '../http/http.service';
import { ReferenceDataService } from './reference-data.service';

describe('ReferenceDataService (sync accessors, preload, refetch-on-miss)', () => {
  let service: ReferenceDataService;
  let get: jasmine.Spy;
  let crops: { id: number; name: string }[];

  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    crops = [{ id: 1, name: 'Wheat' }];
    get = jasmine.createSpy('get').and.callFake((path: string) => {
      const items = path === '/reference/crops' ? crops : [];
      return Promise.resolve({ items });
    });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: HttpService, useValue: { get } }],
    });
    service = TestBed.inject(ReferenceDataService);
  });

  it('returns an empty name before the data has loaded', () => {
    expect(service.cropName(1)).toBe('');
    expect(service.cropName(null)).toBe('');
  });

  it('resolves names synchronously once ready', async () => {
    await service.ready();
    expect(service.cropName(1)).toBe('Wheat');
    expect(service.activityTypeName(9)).toBe('');
  });

  it('preload issues one request per endpoint and ready() reuses them', async () => {
    service.preload();
    await service.ready();
    await service.ready();
    expect(get).toHaveBeenCalledTimes(5);
  });

  it('bumps version when names arrive', async () => {
    const before = service.version();
    await service.ready();
    expect(service.version()).toBeGreaterThan(before);
  });

  it('refetches only the missing endpoint on a miss, then resolves it', async () => {
    await service.ready();
    get.calls.reset();
    crops.push({ id: 2, name: 'Rice' }); // created elsewhere

    expect(service.cropName(2)).toBe('');
    await flush();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/reference/crops');
    expect(service.cropName(2)).toBe('Rice');
  });

  it('throttles repeated misses for an unknown id', async () => {
    await service.ready();
    get.calls.reset();

    service.cropName(99);
    await flush();
    service.cropName(99);
    service.cropName(99);
    await flush();

    expect(get).toHaveBeenCalledTimes(1);
    expect(service.cropName(99)).toBe('');
  });

  it('does not refetch on a miss while the first load is still in flight', () => {
    service.preload();
    service.cropName(1);
    expect(get).toHaveBeenCalledTimes(5);
  });

  it('keeps farmer-created crops cached without another fetch', async () => {
    const post = jasmine.createSpy('post').and.resolveTo({ id: 7, name: 'Millet' });
    (TestBed.inject(HttpService) as unknown as { post: jasmine.Spy }).post = post;
    await service.ready();
    get.calls.reset();

    const id = await service.createCrop('Millet');

    expect(id).toBe(7);
    expect(service.cropName(7)).toBe('Millet');
    expect(get).not.toHaveBeenCalled();
  });
});
