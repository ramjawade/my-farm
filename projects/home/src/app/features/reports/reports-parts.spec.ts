import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { CropProfitListComponent } from './crop-profit-list.component';
import { SeasonSummaryComponent } from './season-summary.component';
import { CropProfit, SeasonReport } from './report.service';

function setup<T>(component: new () => T, inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
  });
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, instance: fixture.componentInstance };
}

const crop = (over: Partial<CropProfit>): CropProfit => ({
  cropId: 1,
  cropName: 'Tomato',
  soldCount: 1,
  sales: 1000,
  expenses: 400,
  profitPerAcre: 600,
  ...over,
});

describe('CropProfitListComponent', () => {
  it('shows a dash for profit per acre when the crop has no area', () => {
    const { el } = setup(CropProfitListComponent, { crops: [crop({ profitPerAcre: null })] });

    const text = el.querySelector('li')!.textContent!;
    expect(text).toContain('–');
    expect(text).toContain('reports.profitPerAcre');
    expect(text).not.toContain('+₹');
  });

  it('shows a loss with a minus sign in the danger colour', () => {
    const { el } = setup(CropProfitListComponent, { crops: [crop({ profitPerAcre: -250 })] });

    const figure = el.querySelector('strong.text-danger')!;
    expect(figure.textContent).toContain('−₹250');
  });

  it('says "No sales yet" for a crop that has none', () => {
    const { el } = setup(CropProfitListComponent, {
      crops: [crop({ soldCount: 0, sales: 0, profitPerAcre: -400 })],
    });

    expect(el.textContent).toContain('reports.noSalesYet');
    expect(el.textContent).not.toContain('−₹');
  });

  it('emits the crop id when a row is selected', () => {
    const { el, instance } = setup(CropProfitListComponent, {
      crops: [crop({ cropId: 7 })],
    });
    const opened: number[] = [];
    instance.open.subscribe((id) => opened.push(id));

    el.querySelector<HTMLButtonElement>('li button')!.click();

    expect(opened).toEqual([7]);
  });
});

describe('SeasonSummaryComponent', () => {
  const report = (over: Partial<SeasonReport>): SeasonReport => ({
    season: 'Kharif',
    year: 2026,
    totalExpense: 18900,
    totalSales: 26000,
    net: 7100,
    cropsSold: 1,
    byCategory: [],
    crops: [crop({})],
    byMonth: [],
    hasData: true,
    ...over,
  });

  it('shows net in the success colour when positive', () => {
    const { el } = setup(SeasonSummaryComponent, { report: report({}) });

    const net = el.querySelector('[data-testid="net"]')!;
    expect(net.textContent).toContain('+₹7,100');
    expect(net.classList).toContain('text-success');
  });

  it('shows net in the danger colour when negative', () => {
    const { el } = setup(SeasonSummaryComponent, {
      report: report({ net: -3000, totalSales: 0, totalExpense: 3000 }),
    });

    const net = el.querySelector('[data-testid="net"]')!;
    expect(net.textContent).toContain('−₹3,000');
    expect(net.classList).toContain('text-danger');
  });

  it('explains Net so far in a hint', () => {
    const { el } = setup(SeasonSummaryComponent, { report: report({}) });

    expect(el.textContent).toContain('reports.netHint');
  });
});
