import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ReferenceDataService } from '../../core/api/reference-data.service';
import { PricesPageData } from './prices-data';
import { PricesListComponent } from './prices-list.component';
import { PricesService } from './prices.service';
import { CropTypeRow } from './prices.utils';

const mandi = (id: number, price: number | null, extra: object = {}) => ({
  mandi: { id, name: `Market ${id}`, district: 'Nashik' },
  price,
  price_date: new Date().toISOString().slice(0, 10),
  ...extra,
});

const ok = (rows: CropTypeRow[], mine = 2): PricesPageData => ({
  status: 'ok',
  rows,
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
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  function open(data: PricesPageData): void {
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  }

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', ['latest', 'myMandis']);
    TestBed.configureTestingModule({
      imports: [PricesListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: PricesService, useValue: prices },
        {
          provide: ReferenceDataService,
          useValue: {
            cropName: (id: number) => ({ 5: 'Onion', 6: 'Wheat', 7: 'Sugarcane' })[id] ?? '',
            ready: () => Promise.resolve(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PricesListComponent);
  });

  it('shows the best price among the followed mandis with its change and market', () => {
    open(
      ok([
        {
          catalogId: 5,
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
        { catalogId: 5, commodity: 'Onion', mandis: [mandi(1, 2150, { change_pct: 0 })] },
        { catalogId: 6, commodity: 'Wheat', mandis: [mandi(1, 2400, { change_pct: -1.5 })] },
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
          commodity: 'Onion',
          mandis: [mandi(1, 2150, { price_date: '2020-01-01' })],
        },
      ]),
    );
    expect(text()).toContain('prices.updated');
  });

  it('does not say "updated" for a price from today', () => {
    open(ok([{ catalogId: 5, commodity: 'Onion', mandis: [mandi(1, 2150)] }]));
    expect(text()).not.toContain('prices.updated');
  });

  it('expands to each followed mandi with the best marked and the gap shown', () => {
    open(
      ok(
        [
          {
            catalogId: 5,
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
    open(ok([{ catalogId: 7, commodity: null, mandis: [mandi(1, null)] }]));
    expect(text()).toContain('prices.noPrice');
  });

  it('shows "Not traded" with a Change APMCs link when no followed mandi has a price', () => {
    open(ok([{ catalogId: 5, commodity: 'Onion', mandis: [mandi(1, null)] }]));
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
});
