import { Activity, ActivityStatus } from '../../activity/activity.models';
import { CropSale } from './crop-sale.models';
import { salesFromActivities, sortSales, summarizeSales } from './sales-summary';

const SALE_TYPE = 9;

const sale = (
  id: number,
  date: number,
  amount: number,
  status: ActivityStatus = 'Completed',
): CropSale => ({ id, cropId: 1, date, status, quantity: 1, unit: 'kg', rate: amount, amount });

const activity = (over: Partial<Activity>): Activity => ({
  id: 1,
  activityTypeId: SALE_TYPE,
  cropId: 1,
  status: 'Completed',
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('summarizeSales', () => {
  it('totals completed sales and subtracts expenses', () => {
    const s = summarizeSales([sale(1, 1, 11000), sale(2, 2, 15000)], 18900, 1, 'acres');
    expect(s).toEqual({ total: 26000, profit: 7100, profitPerAcre: 7100, hasCompleted: true });
  });

  it('does not count a planned sale', () => {
    const s = summarizeSales([sale(1, 1, 11000), sale(2, 2, 99999, 'Scheduled')], 1000, 1, 'acres');
    expect(s.total).toBe(11000);
    expect(s.hasCompleted).toBe(true);
  });

  it('has nothing completed when only planned sales exist', () => {
    const s = summarizeSales([sale(1, 1, 500, 'Scheduled')], 1000, 1, 'acres');
    expect(s.hasCompleted).toBe(false);
    expect(s.total).toBe(0);
  });

  it('goes negative when expenses are higher', () => {
    const s = summarizeSales([sale(1, 1, 1000)], 4000, 2, 'acres');
    expect(s.profit).toBe(-3000);
    expect(s.profitPerAcre).toBe(-1500);
  });

  it('converts hectares to acres', () => {
    const s = summarizeSales([sale(1, 1, 24710.5)], 0, 1, 'hectares');
    expect(s.profitPerAcre).toBe(10000);
  });

  it('has no per-acre figure without an area', () => {
    expect(summarizeSales([sale(1, 1, 100)], 0, 0, 'acres').profitPerAcre).toBeNull();
  });
});

describe('sortSales', () => {
  it('puts the newest first and breaks ties by id', () => {
    const sorted = sortSales([sale(1, 1, 1), sale(3, 2, 1), sale(2, 2, 1)]);
    expect(sorted.map((s) => s.id)).toEqual([3, 2, 1]);
  });

  it('puts undated sales last', () => {
    const undated: CropSale = { id: 9, cropId: 1, status: 'Scheduled' };
    expect(sortSales([undated, sale(1, 1, 1)]).map((s) => s.id)).toEqual([1, 9]);
  });
});

describe('salesFromActivities', () => {
  const isSale = (typeId: number) => typeId === SALE_TYPE;

  it('keeps only this crop’s non-cancelled Sale activities', () => {
    const list = [
      activity({ id: 1, sale: { quantity: 12, unit: 'crates', rate: 1250, amount: 15000 } }),
      activity({ id: 2, cropId: 2 }),
      activity({ id: 3, activityTypeId: 4 }),
      activity({ id: 4, status: 'Cancelled' }),
      activity({ id: 5, status: 'Scheduled' }),
    ];
    const sales = salesFromActivities(list, 1, isSale);
    expect(sales.map((s) => s.id)).toEqual([1, 5]);
    expect(sales[0]).toEqual(
      jasmine.objectContaining({ quantity: 12, unit: 'crates', rate: 1250, amount: 15000 }),
    );
    expect(sales[1].amount).toBeUndefined();
  });
});
