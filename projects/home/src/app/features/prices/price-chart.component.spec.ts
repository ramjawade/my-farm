import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Chart } from 'chart.js';
import { ChartLine, PriceChartComponent } from './price-chart.component';

const line = (name: string, prices: Array<[string, number]>, dashed = false): ChartLine => ({
  name,
  token: '--mf-chart-1',
  dashed,
  points: prices.map(([date, price]) => ({ date, price })),
});

describe('PriceChartComponent', () => {
  let fixture: ComponentFixture<PriceChartComponent>;

  const chart = () =>
    Chart.getChart(fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement);

  async function render(lines: ChartLine[]): Promise<void> {
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('label', 'Onion price at Market 1, from ₹2000 to ₹2150');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PriceChartComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(PriceChartComponent);
  });

  afterEach(() => chart()?.destroy());

  it('draws one dataset per line, on the dates that have a reading', async () => {
    await render([
      line('Market 1', [
        ['2026-10-15', 2000],
        ['2026-10-17', 2150],
      ]),
      line('Market 2', [['2026-10-16', 1900]], true),
    ]);

    expect(chart()?.data.datasets.length).toBe(2);
    expect(chart()?.data.labels?.length).toBe(3);
    expect(chart()?.data.datasets[0].data).toEqual([2000, null, 2150]);
    expect(chart()?.data.datasets[1].data).toEqual([null, 1900, null]);
  });

  it('makes comparison lines dashed and the main line thicker', async () => {
    await render([line('A', [['2026-10-17', 1]]), line('B', [['2026-10-17', 2]], true)]);
    const [main, other] = chart()!.data.datasets as Array<{
      borderDash: number[];
      borderWidth: number;
    }>;
    expect(main.borderDash).toEqual([]);
    expect(other.borderDash.length).toBeGreaterThan(0);
    expect(main.borderWidth).toBeGreaterThan(other.borderWidth);
  });

  it('gives screen readers a label and a table of the prices', async () => {
    await render([line('Market 1', [['2026-10-17', 2150]])]);
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('Onion price');
    const cells = Array.from(fixture.nativeElement.querySelectorAll('tbody td')).map((c) =>
      (c as HTMLElement).textContent?.trim(),
    );
    expect(cells).toEqual(['2150']);
  });

  it('draws nothing for no points', async () => {
    await render([line('Market 1', [])]);
    expect(chart()).toBeUndefined();
  });

  it('redraws when the lines change', async () => {
    await render([line('A', [['2026-10-17', 1]])]);
    await render([line('A', [['2026-10-17', 1]]), line('B', [['2026-10-17', 2]], true)]);
    expect(chart()?.data.datasets.length).toBe(2);
  });
});
