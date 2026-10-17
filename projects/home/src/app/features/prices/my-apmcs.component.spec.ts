import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { MyApmcsData } from './prices-data';
import { MyApmcsComponent } from './my-apmcs.component';
import { PricesService } from './prices.service';

const m = (id: number, district = 'Nashik') => ({ id, name: `Market ${id}`, district });

function data(over: Partial<Extract<MyApmcsData, { status: 'ok' }>> = {}): MyApmcsData {
  return {
    status: 'ok',
    mine: [m(1), m(2)],
    suggested: false,
    districts: ['Nashik', 'Pune'],
    commodities: ['Onion', 'Wheat'],
    ...over,
  };
}

describe('MyApmcsComponent', () => {
  let fixture: ComponentFixture<MyApmcsComponent>;
  let prices: jasmine.SpyObj<PricesService>;
  let navigate: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const button = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').includes(label),
    );

  async function open(d: MyApmcsData, pick?: string): Promise<void> {
    fixture.componentRef.setInput('data', d);
    if (pick) fixture.componentRef.setInput('pick', pick);
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  beforeEach(() => {
    prices = jasmine.createSpyObj<PricesService>('PricesService', [
      'findMandis',
      'saveMandis',
      'latest',
      'myMandis',
      'districts',
    ]);
    prices.findMandis.and.resolveTo([m(3), m(4), m(5)]);
    prices.saveMandis.and.resolveTo({ items: [], suggested: false } as never);
    TestBed.configureTestingModule({
      imports: [MyApmcsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: PricesService, useValue: prices },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(MyApmcsComponent);
  });

  it('lists the chosen markets and the first search results', async () => {
    await open(data());
    expect(text()).toContain('Market 1');
    expect(text()).toContain('Market 2');
    expect(text()).toContain('Market 3');
    expect(prices.findMandis).toHaveBeenCalledWith({ district: undefined, q: '', limit: 50 });
  });

  it('adds a found market and enables saving the new list', async () => {
    await open(data());
    button('prices.addNamed')?.click();
    fixture.detectChanges();
    expect(text()).toContain('prices.countOfMax');
    expect(el().querySelectorAll('ul')[0].querySelectorAll('li').length).toBe(3);
  });

  it('removes a chosen market', async () => {
    await open(data());
    button('prices.removeNamed')?.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('ul')[0].querySelectorAll('li').length).toBe(1);
  });

  it('will not remove the last market and marks it "Keep one"', async () => {
    await open(data({ mine: [m(1)] }));
    expect(button('prices.removeNamed')).toBeUndefined();
    expect(text()).toContain('prices.keepOne');
  });

  it('stops adding at five markets and says so', async () => {
    prices.findMandis.and.resolveTo([m(6)]);
    await open(data({ mine: [m(1), m(2), m(3), m(4), m(5)] }));
    expect(text()).toContain('prices.limitReached');
    expect(button('prices.addNamed')?.disabled).toBeTrue();
  });

  it('marks the suggested markets of a first visit, and clears the mark once changed', async () => {
    await open(data({ suggested: true }));
    expect(text()).toContain('prices.suggestedNote');
    expect(text()).toContain('prices.suggested');

    button('prices.removeNamed')?.click();
    fixture.detectChanges();
    expect(text()).not.toContain('prices.suggestedNote');
  });

  it('filters by district and by name', async () => {
    await open(data());
    const select = el().querySelector<HTMLSelectElement>('#apmc-district')!;
    select.value = 'Pune';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(prices.findMandis).toHaveBeenCalledWith(jasmine.objectContaining({ district: 'Pune' }));

    jasmine.clock().install();
    try {
      const search = el().querySelector<HTMLInputElement>('#apmc-search')!;
      search.value = 'lasal';
      search.dispatchEvent(new Event('input'));
      jasmine.clock().tick(400);
    } finally {
      jasmine.clock().uninstall();
    }
    await settle();
    expect(prices.findMandis).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'lasal' }));
  });

  it('"only markets that trade my crops" asks once per crop and merges the results', async () => {
    prices.findMandis.and.callFake(async (f = {}) =>
      f.commodity === 'Onion' ? [m(8), m(7)] : f.commodity === 'Wheat' ? [m(7), m(9)] : [m(3)],
    );
    await open(data());
    const toggle = el().querySelector<HTMLInputElement>('#apmc-mine')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await settle();

    expect(prices.findMandis).toHaveBeenCalledWith(
      jasmine.objectContaining({ commodity: 'Onion' }),
    );
    expect(prices.findMandis).toHaveBeenCalledWith(
      jasmine.objectContaining({ commodity: 'Wheat' }),
    );
    const names = Array.from(el().querySelectorAll('ul')[1].querySelectorAll('strong')).map((s) =>
      s.textContent?.trim(),
    );
    expect(names).toEqual(['Market 7', 'Market 8', 'Market 9']);
  });

  it('saves the chosen markets in order and goes back to Prices', async () => {
    await open(data());
    button('prices.addNamed')?.click();
    fixture.detectChanges();
    button('prices.save')?.click();
    await settle();

    expect(prices.saveMandis).toHaveBeenCalledWith([1, 2, 3]);
    expect(navigate).toHaveBeenCalledWith(['/prices']);
  });

  it('stays on the page with its choices when saving fails', async () => {
    prices.saveMandis.and.rejectWith(new Error('down'));
    await open(data());
    button('prices.save')?.click();
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    expect(text()).toContain('Market 1');
  });

  it('asks the farmer to choose when they were sent here with nothing chosen', async () => {
    await open(data({ mine: [] }), '1');
    expect(text()).toContain('prices.pickNeeded');
    expect(text()).toContain('prices.noneChosen');
    expect(button('prices.save')?.disabled).toBeTrue();
  });

  it('shows an error with Try again that reloads', async () => {
    await open({ status: 'error' });
    expect(text()).toContain('prices.errorTitle');

    prices.latest.and.resolveTo({ crops: [] } as never);
    prices.myMandis.and.resolveTo({ items: [m(1)], suggested: false } as never);
    prices.districts.and.resolveTo(['Nashik']);
    button('prices.retry')?.click();
    await settle();
    expect(prices.districts).toHaveBeenCalled();
    expect(text()).toContain('Market 1');
  });
});
