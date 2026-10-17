import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RedirectCommand,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import {
  loadMyApmcs,
  loadPriceDetail,
  loadPricesPage,
  parsePeriod,
  priceDetailResolver,
  pricesResolver,
} from './prices-data';
import { PricesService } from './prices.service';

const mandi = (id: number, price: number | null) => ({
  mandi: { id, name: `M${id}`, district: 'Nashik' },
  price,
  price_date: '2026-10-17',
});
const crop = (
  cropId: number,
  catalogId: number,
  commodity: string | null,
  mandis = [mandi(1, 2150)],
) => ({
  crop_id: cropId,
  crop_catalog_id: catalogId,
  commodity,
  mandis,
});
const history = (days: number) => ({
  days,
  points: [{ date: '2026-10-17', price: 2150 }],
  lowest: 2150,
  average: 2150,
  highest: 2150,
});

describe('prices data loaders', () => {
  let prices: jasmine.SpyObj<PricesService>;

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', [
      'latest',
      'myMandis',
      'history',
      'districts',
    ]);
    prices.latest.and.resolveTo({ crops: [crop(1, 5, 'Onion'), crop(2, 5, 'Onion')] } as never);
    prices.myMandis.and.resolveTo({ items: [mandi(1, null).mandi], suggested: false } as never);
    prices.history.and.callFake(async (_m, _c, days) => history(days) as never);
    prices.districts.and.resolveTo(['Nashik', 'Pune']);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PricesService, useValue: prices },
        { provide: ReferenceDataService, useValue: { ready: () => Promise.resolve() } },
      ],
    });
  });

  describe('loadPricesPage', () => {
    it('groups plantings of one crop into one row and carries the followed mandis', async () => {
      const data = await loadPricesPage(prices);
      expect(data.status).toBe('ok');
      if (data.status !== 'ok') return;
      expect(data.rows.length).toBe(1);
      expect(data.mine.map((m) => m.id)).toEqual([1]);
      expect(data.suggested).toBeFalse();
    });

    it('turns a failure into an error state instead of throwing', async () => {
      prices.latest.and.rejectWith(new Error('down'));
      expect(await loadPricesPage(prices)).toEqual({ status: 'error' });
    });
  });

  describe('pricesResolver', () => {
    const run = () =>
      TestBed.runInInjectionContext(() =>
        pricesResolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as Promise<unknown>;

    it('opens the page when there are mandis to show', async () => {
      expect(((await run()) as { status: string }).status).toBe('ok');
    });

    it('sends a farmer with crops but no mandi to My APMCs with a message', async () => {
      prices.myMandis.and.resolveTo({ items: [], suggested: true } as never);
      const result = await run();
      expect(result instanceof RedirectCommand).toBeTrue();
      expect(String((result as RedirectCommand).redirectTo)).toBe('/prices/mandis?pick=1');
    });

    it('does not redirect a farmer with no crops', async () => {
      prices.latest.and.resolveTo({ crops: [] } as never);
      prices.myMandis.and.resolveTo({ items: [], suggested: true } as never);
      expect(((await run()) as { status: string }).status).toBe('ok');
    });
  });

  describe('loadPriceDetail', () => {
    beforeEach(() => {
      prices.latest.and.resolveTo({
        crops: [crop(1, 5, 'Onion', [mandi(1, 2040), mandi(2, 2150), mandi(3, null)])],
      } as never);
    });

    it('opens on the best mandi and loads the 30-day figures', async () => {
      const data = await loadPriceDetail(prices, 5, 0, 30);
      expect(data.status).toBe('ok');
      if (data.status !== 'ok') return;
      expect(data.mandiId).toBe(2);
      expect(data.priced.map((m) => m.mandi.id)).toEqual([2, 1]);
      expect(prices.history).toHaveBeenCalledTimes(1);
      expect(data.history).toBe(data.history30);
    });

    it('opens on the requested mandi and loads the period as well', async () => {
      const data = await loadPriceDetail(prices, 5, 1, 7);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.mandiId).toBe(1);
      expect(prices.history).toHaveBeenCalledWith(1, 'Onion', 30);
      expect(prices.history).toHaveBeenCalledWith(1, 'Onion', 7);
    });

    it('ignores a requested mandi that has no price', async () => {
      const data = await loadPriceDetail(prices, 5, 3, 30);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.mandiId).toBe(2);
    });

    it('is not found for an unknown crop, an unpriced crop, or a crop with no commodity', async () => {
      expect((await loadPriceDetail(prices, 99, 0, 30)).status).toBe('notFound');
      prices.latest.and.resolveTo({ crops: [crop(1, 5, 'Onion', [mandi(1, null)])] } as never);
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('notFound');
      prices.latest.and.resolveTo({ crops: [crop(1, 5, null)] } as never);
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('notFound');
    });

    it('turns a failure into an error state', async () => {
      prices.history.and.rejectWith(new Error('down'));
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('error');
    });

    it('reads the period and mandi from the link', async () => {
      const route = {
        paramMap: new Map([['crop', '5']]),
        queryParamMap: new Map([
          ['mandi', '1'],
          ['period', '365'],
        ]),
      } as unknown as ActivatedRouteSnapshot;
      const data = await TestBed.runInInjectionContext(() =>
        priceDetailResolver(route, {} as RouterStateSnapshot),
      );
      expect((data as { days: number }).days).toBe(365);
      expect((data as { mandiId: number }).mandiId).toBe(1);
    });
  });

  it('parses the chart period, defaulting to 30 days', () => {
    expect([
      parsePeriod('7'),
      parsePeriod('365'),
      parsePeriod('30'),
      parsePeriod('x'),
      parsePeriod(null),
    ]).toEqual([7, 365, 30, 30, 30]);
  });

  describe('loadMyApmcs', () => {
    it("carries the districts and the farmer's feed commodities", async () => {
      prices.latest.and.resolveTo({
        crops: [crop(1, 5, 'Onion'), crop(2, 6, 'Wheat'), crop(3, 7, null)],
      } as never);
      const data = await loadMyApmcs(prices);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.districts).toEqual(['Nashik', 'Pune']);
      expect(data.commodities).toEqual(['Onion', 'Wheat']);
    });

    it('is an error state when anything fails', async () => {
      prices.districts.and.rejectWith(new Error('down'));
      expect(await loadMyApmcs(prices)).toEqual({ status: 'error' });
    });
  });
});
