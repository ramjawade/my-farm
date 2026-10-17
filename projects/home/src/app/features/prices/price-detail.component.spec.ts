import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { PriceHistoryResponse } from '../../core/api/contracts';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { PriceDetailData } from './prices-data';
import { PriceDetailComponent } from './price-detail.component';
import { PricesService } from './prices.service';

const today = new Date().toISOString().slice(0, 10);
const entry = (id: number, price: number, extra: object = {}) => ({
  mandi: { id, name: `Market ${id}`, district: 'Nashik' },
  price,
  price_date: today,
  ...extra,
});
const history = (days: number, prices: number[], average?: number): PriceHistoryResponse =>
  ({
    mandi: { id: 1, name: 'x', district: 'y' },
    commodity: 'Onion',
    days,
    points: prices.map((price, i) => ({ date: `2026-10-${10 + i}`, price })),
    lowest: Math.min(...prices),
    average: average ?? prices.reduce((a, b) => a + b, 0) / prices.length,
    highest: Math.max(...prices),
  }) as PriceHistoryResponse;

function okData(
  overrides: Partial<Extract<PriceDetailData, { status: 'ok' }>> = {},
): PriceDetailData {
  const priced = [entry(2, 2150, { change_pct: 6.4 }), entry(1, 2040), entry(3, 1900)];
  return {
    status: 'ok',
    row: { catalogId: 5, cropIds: [5], commodity: 'Onion', mandis: priced },
    priced,
    mandiId: 2,
    days: 30,
    history30: history(30, [2000, 2050, 2150], 2000),
    history: history(30, [2000, 2050, 2150], 2000),
    ...overrides,
  } as PriceDetailData;
}

describe('PriceDetailComponent', () => {
  let fixture: ComponentFixture<PriceDetailComponent>;
  let prices: jasmine.SpyObj<PricesService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button'));
  const button = (match: string) => buttons().find((b) => (b.textContent ?? '').includes(match));

  async function open(data: PriceDetailData): Promise<void> {
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  async function click(b: HTMLButtonElement | undefined): Promise<void> {
    b?.click();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', [
      'history',
      'latest',
      'myMandis',
    ]);
    prices.history.and.callFake(async (id, _c, days) =>
      history(days, [1000 + id * 100, 1100 + id * 100]),
    );
    TestBed.configureTestingModule({
      imports: [PriceDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: PricesService, useValue: prices },
        {
          provide: ReferenceDataService,
          useValue: { cropName: () => 'Onion', ready: () => Promise.resolve() },
        },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PriceDetailComponent);
  });

  it('shows the crop, the market, the price per quintal and the change', async () => {
    await open(okData());
    expect(text()).toContain('Market 2 · Nashik');
    expect(text()).toContain('₹2,150');
    expect(text()).toContain('6.4%');
    expect(text()).toContain('prices.perQuintalShort');
  });

  it('badges the price against the 30-day average: above, below and near', async () => {
    await open(
      okData({ history30: history(30, [2000], 2000), history: history(30, [2000], 2000) }),
    );
    expect(text()).toContain('prices.badge.above');

    await open(
      okData({ history30: history(30, [2400], 2400), history: history(30, [2400], 2400) }),
    );
    expect(text()).toContain('prices.badge.below');

    await open(
      okData({ history30: history(30, [2150], 2150), history: history(30, [2150], 2150) }),
    );
    expect(text()).toContain('prices.badge.near');
  });

  it('shows the lowest, average and highest of the chosen period', async () => {
    await open(
      okData({
        history: history(30, [2000, 2300], 2150),
        history30: history(30, [2000, 2300], 2150),
      }),
    );
    expect(text()).toContain('₹2,000');
    expect(text()).toContain('₹2,150');
    expect(text()).toContain('₹2,300');
  });

  it('loads and shows another period when it is chosen', async () => {
    await open(okData());
    await click(button('prices.period.7'));

    expect(prices.history).toHaveBeenCalledWith(2, 'Onion', 7);
    expect(button('prices.period.7')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('prices.period.30')?.getAttribute('aria-pressed')).toBe('false');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalled();
  });

  it('does not fetch a period it already has', async () => {
    await open(okData());
    await click(button('prices.period.7'));
    await click(button('prices.period.30'));
    await click(button('prices.period.7'));
    expect(prices.history.calls.allArgs().filter((a) => a[2] === 7).length).toBe(1);
  });

  it('switches to another market and clears the comparison', async () => {
    await open(okData());
    await click(button('Market 1 · ₹2,040'));
    expect(prices.history).toHaveBeenCalledWith(1, 'Onion', 30);
    expect(text()).toContain('Market 1 · Nashik');
    expect(el().querySelectorAll('[aria-pressed="true"]').length).toBeGreaterThan(0);
  });

  it('adds a comparison line and lists it in the legend with its change', async () => {
    await open(okData());
    // Market 2 is the main line; compare it with Market 3 using the chip in the Compare card.
    const compare = () =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('section:last-of-type button'));
    await click(compare().find((b) => b.textContent?.includes('Market 3')));

    expect(prices.history).toHaveBeenCalledWith(3, 'Onion', 30);
    const legend = Array.from(el().querySelectorAll('section:last-of-type li')).map(
      (li) => li.textContent ?? '',
    );
    expect(legend.length).toBe(2);
    expect(legend[0]).toContain('Market 2');
    expect(legend[1]).toContain('Market 3');
    expect(legend[1]).toContain('%');
  });

  it('allows at most three comparisons and disables the rest', async () => {
    const priced = [1, 2, 3, 4, 5].map((i) => entry(i, 2000 + i * 10));
    await open(
      okData({
        priced: priced as never,
        row: { catalogId: 5, cropIds: [5], commodity: 'Onion', mandis: priced as never },
        mandiId: 1,
      }),
    );
    const compareButtons = () =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('section:last-of-type button'));
    for (const id of [2, 3, 4])
      await click(compareButtons().find((b) => b.textContent?.includes(`Market ${id}`)));
    const fifth = compareButtons().find((b) => b.textContent?.includes('Market 5'));
    expect(fifth?.disabled).toBeTrue();

    await click(compareButtons().find((b) => b.textContent?.includes('Market 2')));
    expect(compareButtons().find((b) => b.textContent?.includes('Market 5'))?.disabled).toBeFalse();
  });

  it('says how short the history is when it has fewer days than the period', async () => {
    await open(okData());
    expect(text()).toContain('prices.shortHistory');
  });

  it('does not say it for a full period', async () => {
    const week = history(
      7,
      [1, 2, 3, 4, 5, 6, 7].map((n) => 2000 + n),
    );
    await open(okData({ days: 7, history: week }));
    expect(text()).not.toContain('prices.shortHistory');
  });

  it('says there is no new price today when the reading is older', async () => {
    const old = entry(2, 2150, { price_date: '2020-01-01' });
    await open(
      okData({
        priced: [old] as never,
        row: { catalogId: 5, cropIds: [5], commodity: 'Onion', mandis: [old] as never },
      }),
    );
    expect(text()).toContain('prices.noNewToday');
  });

  it('draws the chart when there are points and says so when there are none', async () => {
    await open(okData());
    expect(el().querySelector('app-price-chart')).not.toBeNull();

    await open(okData({ history: history(30, []), history30: history(30, [], 0) }));
    expect(el().querySelector('app-price-chart')).toBeNull();
    expect(text()).toContain('prices.noHistory');
  });

  it('shows a message for a crop with no price, with a link to change markets', async () => {
    await open({ status: 'notFound' });
    expect(text()).toContain('prices.notFoundTitle');
    expect(el().querySelector('a[href="/prices/mandis"]')).not.toBeNull();
  });

  it('shows an error with Try again that reloads', async () => {
    await open({ status: 'error' });
    expect(text()).toContain('prices.errorTitle');

    const priced = [entry(2, 2150)];
    prices.latest.and.resolveTo({
      crops: [{ crop_id: 1, crop_catalog_id: 0, commodity: 'Onion', mandis: priced }],
    } as never);
    prices.myMandis.and.resolveTo({ items: [], suggested: false } as never);
    await click(button('prices.retry'));
    expect(prices.latest).toHaveBeenCalled();
  });
});
