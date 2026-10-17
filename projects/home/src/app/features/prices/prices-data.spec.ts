import { HttpErrorResponse } from '@angular/common/http';
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
  loadAddItem,
  loadMyApmcs,
  loadNewList,
  loadPriceDetail,
  loadPricesPage,
  marketToEntry,
  parsePeriod,
  priceDetailResolver,
  pricesResolver,
} from './prices-data';
import { PricesService } from './prices.service';
import { WatchlistsService } from './watchlists.service';

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
const market = (id: number, price: number, extra: object = {}) => ({
  mandi: { id, name: `M${id}`, district: 'Nashik' },
  price,
  price_date: '2026-10-17',
  ...extra,
});
const list = (id: number, name: string, items: object[] = []) => ({ id, name, items });

describe('prices data loaders', () => {
  let prices: jasmine.SpyObj<PricesService>;
  let watchlists: jasmine.SpyObj<WatchlistsService>;
  let references: { ready: jasmine.Spy; listCrops: jasmine.Spy };

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', [
      'latest',
      'myMandis',
      'history',
      'districts',
      'cropMarkets',
    ]);
    watchlists = jasmine.createSpyObj<WatchlistsService>('WatchlistsService', ['list']);
    references = {
      ready: jasmine.createSpy('ready').and.resolveTo(),
      listCrops: jasmine.createSpy('listCrops').and.resolveTo([]),
    };
    prices.latest.and.resolveTo({ crops: [crop(1, 5, 'Onion'), crop(2, 5, 'Onion')] } as never);
    prices.myMandis.and.resolveTo({ items: [mandi(1, null).mandi], suggested: false } as never);
    prices.history.and.callFake(async (_m, _c, days) => history(days) as never);
    prices.districts.and.resolveTo(['Nashik', 'Pune']);
    prices.cropMarkets.and.resolveTo({
      crop_catalog_id: 5,
      commodity: 'Onion',
      markets: [market(2, 2150), market(1, 2040)],
    } as never);
    watchlists.list.and.resolveTo([list(7, 'Onion markets')] as never);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PricesService, useValue: prices },
        { provide: WatchlistsService, useValue: watchlists },
        { provide: ReferenceDataService, useValue: references },
      ],
    });
  });

  describe('loadPricesPage', () => {
    it('groups plantings of one crop into one row and carries the mandis and the lists', async () => {
      const data = await loadPricesPage(prices, watchlists);
      expect(data.status).toBe('ok');
      if (data.status !== 'ok') return;
      expect(data.rows.length).toBe(1);
      expect(data.mine.map((m) => m.id)).toEqual([1]);
      expect(data.suggested).toBeFalse();
      expect(data.lists.map((l) => l.name)).toEqual(['Onion markets']);
    });

    it('turns a failure of prices or of lists into an error state instead of throwing', async () => {
      prices.latest.and.rejectWith(new Error('down'));
      expect(await loadPricesPage(prices, watchlists)).toEqual({ status: 'error' });

      prices.latest.and.resolveTo({ crops: [] } as never);
      watchlists.list.and.rejectWith(new Error('down'));
      expect(await loadPricesPage(prices, watchlists)).toEqual({ status: 'error' });
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
    it('opens on the best market and loads the 30-day figures', async () => {
      const data = await loadPriceDetail(prices, 5, 0, 30);
      expect(data.status).toBe('ok');
      if (data.status !== 'ok') return;
      expect(data.mandiId).toBe(2);
      expect(data.row).toEqual({ catalogId: 5, commodity: 'Onion' });
      expect(data.priced.map((m) => m.mandi.id)).toEqual([2, 1]);
      expect(prices.history).toHaveBeenCalledTimes(1);
      expect(prices.history).toHaveBeenCalledWith(2, 'Onion', 30);
      expect(data.history).toBe(data.history30);
    });

    it('asks for the markets of the crop, with the opened market always included', async () => {
      await loadPriceDetail(prices, 5, 1, 30);
      expect(prices.cropMarkets).toHaveBeenCalledWith(5, { limit: 20, include: 1 });
      await loadPriceDetail(prices, 5, 0, 30);
      expect(prices.cropMarkets).toHaveBeenCalledWith(5, { limit: 20, include: undefined });
    });

    it('opens on the requested market and loads the period as well', async () => {
      const data = await loadPriceDetail(prices, 5, 1, 7);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.mandiId).toBe(1);
      expect(prices.history).toHaveBeenCalledWith(1, 'Onion', 30);
      expect(prices.history).toHaveBeenCalledWith(1, 'Onion', 7);
    });

    it('ignores a requested market that has no price for the crop', async () => {
      const data = await loadPriceDetail(prices, 5, 99, 30);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.mandiId).toBe(2);
    });

    it('works for a crop the farmer does not grow (it needs no farm crop row)', async () => {
      prices.latest.and.resolveTo({ crops: [] } as never);
      const data = await loadPriceDetail(prices, 5, 1, 30);
      expect(data.status).toBe('ok');
      expect(prices.latest).not.toHaveBeenCalled();
    });

    it('is not found when no market prices the crop, or the backend says 404', async () => {
      prices.cropMarkets.and.resolveTo({
        crop_catalog_id: 5,
        commodity: 'Onion',
        markets: [],
      } as never);
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('notFound');

      prices.cropMarkets.and.rejectWith(new HttpErrorResponse({ status: 404 }));
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('notFound');
    });

    it('turns any other failure into an error state', async () => {
      prices.history.and.rejectWith(new Error('down'));
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('error');

      prices.cropMarkets.and.rejectWith(new HttpErrorResponse({ status: 500 }));
      expect((await loadPriceDetail(prices, 5, 0, 30)).status).toBe('error');
    });

    it('reads the period and market from the link', async () => {
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

  it('turns a market into the entry shape the detail page works with', () => {
    expect(
      marketToEntry(market(3, 1900, { previous_price: 1800, change_pct: 5.6 }) as never),
    ).toEqual({
      mandi: { id: 3, name: 'M3', district: 'Nashik' },
      price: 1900,
      price_date: '2026-10-17',
      previous_price: 1800,
      change_pct: 5.6,
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

  describe('loadNewList', () => {
    it("carries the names of the farmer's lists", async () => {
      watchlists.list.and.resolveTo([list(1, 'A'), list(2, 'B')] as never);
      expect(await loadNewList(watchlists as unknown as WatchlistsService)).toEqual({
        status: 'ok',
        names: ['A', 'B'],
      });
    });

    it('is an error state when lists cannot be loaded', async () => {
      watchlists.list.and.rejectWith(new Error('down'));
      expect(await loadNewList(watchlists)).toEqual({ status: 'error' });
    });
  });

  describe('loadAddItem', () => {
    const crops = [
      { id: 5, name: 'Onion', has_price: true },
      { id: 8, name: 'Sugarcane', has_price: false },
      { id: 9, name: 'Dragon fruit', has_price: false, custom: true },
    ];

    it('offers only crops with a price, and knows what the list already holds', async () => {
      references.listCrops.and.resolveTo(crops);
      watchlists.list.and.resolveTo([
        list(7, 'Onion markets', [{ id: 1, crop_catalog_id: 5, mandi: { id: 3 } }]),
      ] as never);
      const data = await loadAddItem(watchlists, references as never, 7);
      if (data.status !== 'ok') return fail('expected ok');
      expect(data.list).toEqual({ id: 7, name: 'Onion markets', count: 1 });
      expect(data.existing).toEqual(['5:3']);
      expect(data.crops.map((c) => c.name)).toEqual(['Onion']);
    });

    it('is not found for a list the farmer does not have', async () => {
      expect((await loadAddItem(watchlists, references as never, 99)).status).toBe('notFound');
    });

    it('is an error state when loading fails', async () => {
      references.listCrops.and.rejectWith(new Error('down'));
      expect((await loadAddItem(watchlists, references as never, 7)).status).toBe('error');
    });
  });
});
