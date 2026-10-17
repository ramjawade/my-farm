import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { AddItemData } from './prices-data';
import { AddItemComponent } from './add-item.component';
import { PricesService } from './prices.service';
import { WatchlistsService } from './watchlists.service';

const crops = [
  { id: 6, name: 'Wheat', has_price: true },
  { id: 5, name: 'Onion', has_price: true },
];
const data = (over: Partial<Extract<AddItemData, { status: 'ok' }>> = {}): AddItemData => ({
  status: 'ok',
  list: { id: 7, name: 'Onion markets', count: 1 },
  existing: [],
  crops: crops as never,
  ...over,
});
const market = (id: number, price: number) => ({
  mandi: { id, name: `Market ${id}`, district: 'Nashik' },
  price,
  price_date: '2026-10-17',
});

describe('AddItemComponent', () => {
  let fixture: ComponentFixture<AddItemComponent>;
  let prices: jasmine.SpyObj<PricesService>;
  let watchlists: jasmine.SpyObj<WatchlistsService>;
  let navigate: jasmine.Spy;
  let toast: { success: jasmine.Spy; error: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const crop = () => el().querySelector<HTMLSelectElement>('#ai-crop')!;
  const marketSelect = () => el().querySelector<HTMLSelectElement>('#ai-market')!;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  async function open(d: AddItemData): Promise<void> {
    fixture.componentRef.setInput('data', d);
    fixture.detectChanges();
    await settle();
  }
  async function choose(select: HTMLSelectElement, optionIndex: number): Promise<void> {
    select.selectedIndex = optionIndex;
    select.dispatchEvent(new Event('change'));
    await settle();
  }
  async function submit(): Promise<void> {
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', ['cropMarkets']);
    prices.cropMarkets.and.resolveTo({
      crop_catalog_id: 5,
      commodity: 'Onion',
      markets: [market(2, 2150), market(1, 2040)],
    } as never);
    watchlists = jasmine.createSpyObj<WatchlistsService>('WatchlistsService', ['addItem']);
    watchlists.addItem.and.resolveTo({ id: 1 } as never);
    toast = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      imports: [AddItemComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: PricesService, useValue: prices },
        { provide: WatchlistsService, useValue: watchlists },
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(AddItemComponent);
  });

  it('offers the crops that have a price, A to Z', async () => {
    await open(data());
    const labels = Array.from(crop().options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['prices.selectCrop', 'Onion', 'Wheat']);
    expect(text()).toContain('prices.addItemTitle');
  });

  it('keeps Market disabled until a crop is chosen, then lists the markets best first', async () => {
    await open(data());
    expect(marketSelect().disabled).toBeTrue();

    await choose(crop(), 1); // Onion
    expect(prices.cropMarkets).toHaveBeenCalledWith(5, { limit: 50 });
    expect(marketSelect().disabled).toBeFalse();
    const labels = Array.from(marketSelect().options)
      .slice(1)
      .map((o) => o.textContent?.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual(['Market 2 · Nashik · ₹2,150', 'Market 1 · Nashik · ₹2,040']);
    expect(text()).toContain('prices.bestFirst');
  });

  it('asks for a crop, then for a market, and adds nothing until both are chosen', async () => {
    await open(data());
    await submit();
    expect(text()).toContain('prices.pickCrop');

    await choose(crop(), 1);
    await submit();
    expect(text()).toContain('prices.pickMarket');
    expect(watchlists.addItem).not.toHaveBeenCalled();
  });

  it('adds the item, says so and goes back to the list', async () => {
    await open(data());
    await choose(crop(), 1);
    await choose(marketSelect(), 1); // the best market, id 2
    await submit();

    expect(watchlists.addItem).toHaveBeenCalledWith(7, 5, 2);
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/prices'], { queryParams: { list: 7 } });
  });

  it('refuses a crop at a market the list already holds', async () => {
    await open(data({ existing: ['5:2'] }));
    await choose(crop(), 1);
    await choose(marketSelect(), 1);
    await submit();

    expect(text()).toContain('prices.alreadyInList');
    expect(watchlists.addItem).not.toHaveBeenCalled();
  });

  it('says there are no markets when none prices the crop', async () => {
    prices.cropMarkets.and.resolveTo({
      crop_catalog_id: 5,
      commodity: 'Onion',
      markets: [],
    } as never);
    await open(data());
    await choose(crop(), 1);
    expect(text()).toContain('prices.noMarkets');
  });

  it('says the list is full at twenty items and adds nothing', async () => {
    await open(data({ list: { id: 7, name: 'Onion markets', count: 20 } }));
    expect(text()).toContain('prices.itemLimit');
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();

    await choose(crop(), 1);
    await choose(marketSelect(), 1);
    await submit();
    expect(watchlists.addItem).not.toHaveBeenCalled();
  });

  it('shows the backend refusals for a repeat or a full list that the page missed', async () => {
    await open(data());
    await choose(crop(), 1);
    await choose(marketSelect(), 1);

    watchlists.addItem.and.rejectWith(
      new HttpErrorResponse({ status: 409, error: { title: 'duplicate_item' } }),
    );
    await submit();
    expect(text()).toContain('prices.alreadyInList');

    watchlists.addItem.and.rejectWith(
      new HttpErrorResponse({ status: 409, error: { title: 'item_limit' } }),
    );
    await submit();
    expect(text()).toContain('prices.itemLimit');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows a message when the markets of a crop cannot be loaded', async () => {
    prices.cropMarkets.and.rejectWith(new Error('down'));
    await open(data());
    await choose(crop(), 1);
    expect(text()).toContain('prices.errorTitle');
  });

  it('shows not-found and error states instead of the form', async () => {
    await open({ status: 'notFound' });
    expect(text()).toContain('prices.listNotFoundTitle');
    expect(el().querySelector('form')).toBeNull();

    await open({ status: 'error' });
    expect(text()).toContain('prices.errorTitle');
  });
});
