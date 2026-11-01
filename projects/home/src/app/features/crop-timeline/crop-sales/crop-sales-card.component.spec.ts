import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { CropSale } from './crop-sale.models';
import { CropSalesCardComponent } from './crop-sales-card.component';
import { SalesSummary } from './sales-summary';

const sale: CropSale = {
  id: 1,
  cropId: 3,
  date: new Date(2026, 9, 2).getTime(),
  status: 'Completed',
  quantity: 12,
  unit: 'crates',
  rate: 1250,
  amount: 15000,
};
const planned: CropSale = { id: 2, cropId: 3, status: 'Scheduled' };

describe('CropSalesCardComponent', () => {
  function setup(sales: CropSale[], profit: number, hasCompleted = true) {
    TestBed.configureTestingModule({
      imports: [CropSalesCardComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    const fixture = TestBed.createComponent(CropSalesCardComponent);
    const summary: SalesSummary = {
      total: hasCompleted ? 15000 : 0,
      profit,
      profitPerAcre: profit,
      hasCompleted,
    };
    fixture.componentRef.setInput('sales', sales);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('expenses', 8000);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the empty state with a Record sale button', () => {
    const { fixture, el } = setup([], 0, false);
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

  it('lists a planned sale without totals or an amount', () => {
    const { el } = setup([planned], 0, false);

    expect(el.textContent).toContain('cropSales.plannedSale');
    expect(el.textContent).toContain('status.scheduled');
    expect(el.textContent).not.toContain('cropSales.totalSales');
    expect(el.textContent).not.toContain('₹');
  });

  it('mixes a completed and a planned sale, counting only the completed one', () => {
    const { el } = setup([sale, planned], 7000);

    expect(el.querySelectorAll('li').length).toBe(2);
    expect(el.textContent).toContain('cropSales.totalSales');
  });

  it('emits open for the selected row', () => {
    const { fixture, el } = setup([sale, planned], 7000);
    const opened: CropSale[] = [];
    fixture.componentInstance.open.subscribe((s) => opened.push(s));

    el.querySelectorAll<HTMLButtonElement>('li button')[1].click();
    expect(opened).toEqual([planned]);
  });
});
