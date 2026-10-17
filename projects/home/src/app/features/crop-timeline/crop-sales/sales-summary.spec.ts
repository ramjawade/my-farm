import { CropSale } from './crop-sale.models';
import { sortSales, summarizeSales } from './sales-summary';

const sale = (id: number, soldOn: string, amount: number): CropSale => ({
  id,
  cropId: 1,
  soldOn,
  quantity: 1,
  unit: 'kg',
  rate: amount,
  amount,
});

describe('summarizeSales', () => {
  it('totals sales and subtracts expenses', () => {
    const s = summarizeSales(
      [sale(1, '2026-09-30', 11000), sale(2, '2026-10-02', 15000)],
      18900,
      1,
      'acres',
    );
    expect(s).toEqual({ total: 26000, profit: 7100, profitPerAcre: 7100 });
  });

  it('goes negative when expenses are higher', () => {
    const s = summarizeSales([sale(1, '2026-09-30', 1000)], 4000, 2, 'acres');
    expect(s.profit).toBe(-3000);
    expect(s.profitPerAcre).toBe(-1500);
  });

  it('converts hectares to acres', () => {
    const s = summarizeSales([sale(1, '2026-09-30', 24710.5)], 0, 1, 'hectares');
    expect(s.profitPerAcre).toBe(10000);
  });

  it('has no per-acre figure without an area', () => {
    expect(summarizeSales([sale(1, '2026-09-30', 100)], 0, 0, 'acres').profitPerAcre).toBeNull();
  });
});

describe('sortSales', () => {
  it('puts the newest first and breaks ties by id', () => {
    const sorted = sortSales([
      sale(1, '2026-09-30', 1),
      sale(3, '2026-10-02', 1),
      sale(2, '2026-10-02', 1),
    ]);
    expect(sorted.map((s) => s.id)).toEqual([3, 2, 1]);
  });
});
