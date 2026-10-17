import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpService } from '../../core/http/http.service';
import { PricesService } from './prices.service';

describe('PricesService', () => {
  let service: PricesService;
  let get: jasmine.Spy;
  let put: jasmine.Spy;

  beforeEach(() => {
    get = jasmine.createSpy('get').and.resolveTo({ items: [] });
    put = jasmine.createSpy('put').and.resolveTo({ items: [], suggested: false });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpService, useValue: { get, put } },
      ],
    });
    service = TestBed.inject(PricesService);
  });

  it('reads the latest prices', async () => {
    await service.latest();
    expect(get).toHaveBeenCalledWith('/prices/latest');
  });

  it('asks for history with the mandi, commodity and days as query text', async () => {
    await service.history(7, 'Paddy(Common)', 30);
    expect(get).toHaveBeenCalledWith('/prices/history', {
      mandi_id: '7',
      commodity: 'Paddy(Common)',
      days: '30',
    });
  });

  it('saves the chosen mandis in order', async () => {
    await service.saveMandis([3, 1, 2]);
    expect(put).toHaveBeenCalledWith('/me/mandis', { mandi_ids: [3, 1, 2] });
  });

  it('returns the district names', async () => {
    get.and.resolveTo({ items: ['Nashik', 'Pune'] });
    expect(await service.districts()).toEqual(['Nashik', 'Pune']);
  });

  it('sends only the filters that are set when finding mandis', async () => {
    await service.findMandis({ district: 'Nashik', q: '  lasal ', commodity: '', limit: 50 });
    expect(get).toHaveBeenCalledWith('/mandis', { district: 'Nashik', q: 'lasal', limit: '50' });

    get.calls.reset();
    await service.findMandis();
    expect(get).toHaveBeenCalledWith('/mandis', {});
  });
});
