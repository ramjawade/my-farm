import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { CropSale } from './crop-sale.models';
import { CropSalesCardComponent } from './crop-sales-card.component';

const sale: CropSale = {
  id: 1,
  cropId: 3,
  soldOn: '2026-10-02',
  quantity: 12,
  unit: 'crates',
  rate: 1250,
  amount: 15000,
};

describe('CropSalesCardComponent', () => {
  function setup(sales: CropSale[], profit: number) {
    TestBed.configureTestingModule({
      imports: [CropSalesCardComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    const fixture = TestBed.createComponent(CropSalesCardComponent);
    fixture.componentRef.setInput('sales', sales);
    fixture.componentRef.setInput('summary', { total: 15000, profit, profitPerAcre: profit });
    fixture.componentRef.setInput('expenses', 8000);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the empty state with a Record sale button', () => {
    const { fixture, el } = setup([], 0);
    let added = 0;
    fixture.componentInstance.add.subscribe(() => added++);

    expect(el.textContent).toContain('cropSales.emptyTitle');
    el.querySelector<HTMLButtonElement>('button.btn-primary')?.click();
    expect(added).toBe(1);
  });

  it('shows the figures and a row per sale, profit in the success colour', () => {
    const { el } = setup([sale], 7000);

    expect(el.querySelectorAll('li').length).toBe(1);
    expect(el.querySelector('.text-success')?.textContent).toContain('+₹');
    expect(el.querySelector('.text-danger:not(.btn)')).toBeNull();
  });

  it('shows a loss in the danger colour with a minus sign', () => {
    const { el } = setup([sale], -3000);
    expect(el.querySelector('strong.text-danger')?.textContent).toContain('−₹');
  });

  it('emits edit and remove for a row', () => {
    const { fixture, el } = setup([sale], 7000);
    const edited: CropSale[] = [];
    const removed: CropSale[] = [];
    fixture.componentInstance.edit.subscribe((s) => edited.push(s));
    fixture.componentInstance.remove.subscribe((s) => removed.push(s));

    el.querySelector<HTMLButtonElement>('li .btn-outline-secondary')?.click();
    el.querySelector<HTMLButtonElement>('li .btn-outline-danger')?.click();
    expect(edited).toEqual([sale]);
    expect(removed).toEqual([sale]);
  });
});
