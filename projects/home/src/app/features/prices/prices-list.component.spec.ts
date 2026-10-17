import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { PricesPageData } from './prices-data';
import { PricesListComponent } from './prices-list.component';
import { PricesService } from './prices.service';
import { CropTypeRow } from './prices.utils';
import { WatchlistsService } from './watchlists.service';

const mandi = (id: number, price: number | null, extra: object = {}) => ({
  mandi: { id, name: `Market ${id}`, district: 'Nashik' },
  price,
  price_date: new Date().toISOString().slice(0, 10),
  ...extra,
});

const ok = (rows: CropTypeRow[], mine = 2, lists: object[] = []): PricesPageData => ({
  status: 'ok',
  rows,
  lists: lists as never,
  mine: Array.from({ length: mine }, (_, i) => ({
    id: i + 1,
    name: `Market ${i + 1}`,
    district: 'Nashik',
  })),
  suggested: false,
});

describe('PricesListComponent', () => {
  let fixture: ComponentFixture<PricesListComponent>;
  let prices: jasmine.SpyObj<PricesService>;
  let watchlists: jasmine.SpyObj<WatchlistsService>;
  let navigate: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  function open(data: PricesPageData, list?: string): void {
    fixture.componentRef.setInput('data', data);
    if (list !== undefined) fixture.componentRef.setInput('list', list);
    fixture.detectChanges();
  }

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', ['latest', 'myMandis']);
    watchlists = jasmine.createSpyObj<WatchlistsService>('WatchlistsService', [
      'list',
      'remove',
      'removeItem',
    ]);
    watchlists.list.and.resolveTo([]);
    watchlists.remove.and.resolveTo();
    watchlists.removeItem.and.resolveTo();
    TestBed.configureTestingModule({
      imports: [PricesListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: PricesService, useValue: prices },
        { provide: WatchlistsService, useValue: watchlists },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined } },
        {
          provide: ReferenceDataService,
          useValue: {
            cropName: (id: number) => ({ 5: 'Onion', 6: 'Wheat', 7: 'Sugarcane' })[id] ?? '',
            ready: () => Promise.resolve(),
          },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PricesListComponent);
  });

  it('shows the best price among the followed mandis with its change and market', () => {
    open(
      ok([
        {
          catalogId: 5,
          cropIds: [5],
          commodity: 'Onion',
          mandis: [mandi(1, 2040), mandi(2, 2150, { change_pct: 6.4, previous_price: 2020 })],
        },
      ]),
    );
    expect(text()).toContain('₹2,150');
    expect(text()).toContain('6.4%');
    expect(el().querySelector('.text-success.fw-semibold')).not.toBeNull();
    expect(text()).toContain('prices.bestAt');
  });

  it('shows "No change" for a zero change and a fall in the danger colour', () => {
    open(
      ok([
        {
          catalogId: 5,
          cropIds: [5],
          commodity: 'Onion',
          mandis: [mandi(1, 2150, { change_pct: 0 })],
        },
        {
          catalogId: 6,
          cropIds: [6],
          commodity: 'Wheat',
          mandis: [mandi(1, 2400, { change_pct: -1.5 })],
        },
      ]),
    );
    expect(text()).toContain('prices.noChange');
    expect(el().querySelector('.text-danger.fw-semibold')?.textContent).toContain('−1.5%');
  });

  it('says when the price is from an earlier day', () => {
    open(
      ok([
        {
          catalogId: 5,
          cropIds: [5],
          commodity: 'Onion',
          mandis: [mandi(1, 2150, { price_date: '2020-01-01' })],
        },
      ]),
    );
    expect(text()).toContain('prices.updated');
  });

  it('does not say "updated" for a price from today', () => {
    open(ok([{ catalogId: 5, cropIds: [5], commodity: 'Onion', mandis: [mandi(1, 2150)] }]));
    expect(text()).not.toContain('prices.updated');
  });

  it('expands to each followed mandi with the best marked and the gap shown', () => {
    open(
      ok(
        [
          {
            catalogId: 5,
            cropIds: [5],
            commodity: 'Onion',
            mandis: [mandi(1, 2040), mandi(2, 2150), mandi(3, null)],
          },
        ],
        3,
      ),
    );
    expect(el().querySelector('ul ul')).toBeNull();

    el().querySelector<HTMLButtonElement>('button[aria-expanded]')?.click();
    fixture.detectChanges();

    const inner = el().querySelector('ul ul') as HTMLElement;
    expect(inner.textContent).toContain('Market 2');
    expect(inner.textContent).toContain('prices.best');
    expect(inner.textContent).toContain('−₹110');
    expect(inner.textContent).toContain('prices.notTradedHere');
    expect(inner.querySelector('a[href*="/prices/5"]')).not.toBeNull();
  });

  it('shows "No price" for a crop with no price commodity', () => {
    open(ok([{ catalogId: 7, cropIds: [7], commodity: null, mandis: [mandi(1, null)] }]));
    expect(text()).toContain('prices.noPrice');
  });

  it('tells the farmer to pick a specific crop and links to edit the one crop', () => {
    open(ok([{ catalogId: 7, cropIds: [41], commodity: null, mandis: [mandi(1, null)] }]));
    expect(text()).toContain('prices.noPriceHint');
    expect(el().querySelector('a[href="/crops/41/edit"]')).not.toBeNull();
  });

  it('links to the crops list when there are several plantings of a crop with no price', () => {
    open(ok([{ catalogId: 7, cropIds: [41, 42, 43], commodity: null, mandis: [mandi(1, null)] }]));
    expect(el().querySelector('a[href="/crops/41/edit"]')).toBeNull();
    const link = Array.from(el().querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/crops',
    );
    expect(link?.textContent).toContain('prices.editCrops');
  });

  it('shows "Not traded" with a Change APMCs link when no followed mandi has a price', () => {
    open(ok([{ catalogId: 5, cropIds: [5], commodity: 'Onion', mandis: [mandi(1, null)] }]));
    expect(text()).toContain('prices.notTraded');
    expect(el().querySelector('a[href="/prices/mandis"].btn-sm')).not.toBeNull();
  });

  it('shows the empty state with an Add crop link when there are no crops', () => {
    open(ok([]));
    expect(text()).toContain('prices.noCropsTitle');
    expect(el().querySelector('a[href="/crops/add"]')).not.toBeNull();
  });

  it('shows an error with Try again, and reloads when pressed', async () => {
    open({ status: 'error' });
    expect(text()).toContain('prices.errorTitle');

    prices.latest.and.resolveTo({ crops: [] } as never);
    prices.myMandis.and.resolveTo({ items: [], suggested: false } as never);
    watchlists.list.and.resolveTo([]);
    el().querySelector<HTMLButtonElement>('button.btn-outline-success')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(prices.latest).toHaveBeenCalled();
    expect(text()).toContain('prices.noCropsTitle');
  });

  it('shows how many markets are followed', () => {
    open(ok([], 3));
    expect(text()).toContain('prices.myApmcs');
  });

  describe('watchlists', () => {
    const today = new Date().toISOString().slice(0, 10);
    const item = (
      id: number,
      cropId: number,
      market: number,
      price: number | null,
      extra: object = {},
    ) => ({
      id,
      crop_catalog_id: cropId,
      commodity: 'x',
      mandi: { id: market, name: `Market ${market}`, district: 'Pune' },
      price,
      price_date: price === null ? null : today,
      change_pct: null,
      ...extra,
    });
    const onionMarkets = (items: object[] = []) => ({ id: 7, name: 'Onion markets', items });
    const settle = async () => {
      await fixture.whenStable();
      await new Promise<void>((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    };
    const deleteButton = () =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes('prices.deleteList'),
      );

    it('shows My farm first, a tab per list with its count, and + New list', () => {
      open(
        ok([], 2, [
          onionMarkets([item(1, 5, 1, 2150), item(2, 5, 2, 2040)]),
          { id: 8, name: 'Empty', items: [] },
        ]),
      );
      const tabs = Array.from(el().querySelectorAll('[role="group"] button, [role="group"] a')).map(
        (t) => t.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(tabs).toEqual([
        'prices.tabFarm',
        'Onion markets · 2',
        'Empty · 0',
        '+ prices.newList',
      ]);
      expect(el().querySelector('a[href="/prices/lists/new"]')).not.toBeNull();
      expect(el().querySelector('button[aria-pressed="true"]')?.textContent).toContain(
        'prices.tabFarm',
      );
    });

    it('selecting a tab puts the list in the link, and My farm clears it', () => {
      open(ok([], 2, [onionMarkets()]));
      const [farm, list] = Array.from(
        el().querySelectorAll<HTMLButtonElement>('[role="group"] button'),
      );
      list.click();
      expect(navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({ queryParams: { list: 7 }, queryParamsHandling: 'merge' }),
      );
      farm.click();
      expect(navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({ queryParams: { list: null } }),
      );
    });

    it('opens the list named in the link and shows its items', () => {
      open(
        ok([], 2, [onionMarkets([item(1, 5, 1, 2150, { change_pct: 6.4 }), item(2, 6, 2, 2400)])]),
        '7',
      );
      expect(el().querySelector('button[aria-pressed="true"]')?.textContent).toContain(
        'Onion markets',
      );
      expect(text()).toContain('Market 1 · Pune');
      expect(text()).toContain('₹2,150');
      expect(text()).toContain('6.4%');
      expect(text()).toContain('₹2,400');
      expect(text()).toContain('prices.watchHint');
    });

    it('opens the price detail of the crop at that market', () => {
      open(ok([], 2, [onionMarkets([item(1, 5, 3, 2150)])]), '7');
      const link = el().querySelector<HTMLAnchorElement>('li a[href*="/prices/5"]');
      expect(link?.getAttribute('href')).toBe('/prices/5?mandi=3');
    });

    it('says when a price is from an earlier day', () => {
      open(ok([], 2, [onionMarkets([item(1, 5, 1, 2150, { price_date: '2020-01-01' })])]), '7');
      expect(text()).toContain('prices.updated');
    });

    it('shows "Not traded" without a link to a chart when the market has no price', () => {
      open(ok([], 2, [onionMarkets([item(1, 5, 1, null)])]), '7');
      expect(text()).toContain('prices.notTradedHere');
      expect(el().querySelector('li a[href*="/prices/5"]')).toBeNull();
    });

    it('shows an empty list with an Add item link', () => {
      open(ok([], 2, [onionMarkets()]), '7');
      expect(text()).toContain('prices.listEmptyTitle');
      expect(el().querySelectorAll('a[href="/prices/lists/7/add"]').length).toBeGreaterThan(0);
    });

    it('removes an item without asking and updates the tab count', async () => {
      open(ok([], 2, [onionMarkets([item(1, 5, 1, 2150), item(2, 6, 2, 2400)])]), '7');
      el().querySelector<HTMLButtonElement>('li button[aria-label]')?.click();
      await settle();

      expect(watchlists.removeItem).toHaveBeenCalledWith(7, 1);
      expect(el().querySelectorAll('li').length).toBe(1);
      expect(text()).toContain('Onion markets · 1');
    });

    it('keeps the item when removing it fails', async () => {
      watchlists.removeItem.and.rejectWith(new Error('down'));
      open(ok([], 2, [onionMarkets([item(1, 5, 1, 2150)])]), '7');
      el().querySelector<HTMLButtonElement>('li button[aria-label]')?.click();
      await settle();
      expect(el().querySelectorAll('li').length).toBe(1);
    });

    it('asks before deleting a list, then deletes it and shows My farm', async () => {
      open(ok([], 2, [onionMarkets([item(1, 5, 1, 2150)])]), '7');
      deleteButton()?.click();
      fixture.detectChanges();
      expect(el().querySelector('[role="alertdialog"]')).not.toBeNull();
      expect(watchlists.remove).not.toHaveBeenCalled();

      el().querySelector<HTMLButtonElement>('.confirm-dialog .btn-danger')?.click();
      await settle();

      expect(watchlists.remove).toHaveBeenCalledWith(7);
      expect(text()).not.toContain('Onion markets');
      expect(navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({ queryParams: { list: null } }),
      );
    });

    it('does not delete when the farmer cancels', async () => {
      open(ok([], 2, [onionMarkets()]), '7');
      deleteButton()?.click();
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.confirm-dialog .btn-secondary')?.click();
      await settle();
      expect(watchlists.remove).not.toHaveBeenCalled();
      expect(text()).toContain('Onion markets');
    });

    it('falls back to My farm for a link naming a list that no longer exists', () => {
      open(ok([], 2, [onionMarkets()]), '999');
      expect(el().querySelector('button[aria-pressed="true"]')?.textContent).toContain(
        'prices.tabFarm',
      );
      expect(text()).toContain('prices.noCropsTitle');
    });
  });
});
