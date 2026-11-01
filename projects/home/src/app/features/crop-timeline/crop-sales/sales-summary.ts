import { Activity } from '../../activity/activity.models';
import { CropSale } from './crop-sale.models';

const ACRES_PER_HECTARE = 2.47105;

export interface SalesSummary {
  /** Total of the Completed sales; planned ones do not count. */
  total: number;
  /** Completed sales minus the crop's expenses. */
  profit: number;
  /** Profit per acre, rounded to the rupee; null when the crop has no area. */
  profitPerAcre: number | null;
  /** True when at least one sale is Completed, so the figures mean something. */
  hasCompleted: boolean;
}

export function isCompletedSale(sale: CropSale): boolean {
  return sale.status === 'Completed';
}

/** The crop's Sale activities (Cancelled ones left out) as sales. */
export function salesFromActivities(
  activities: readonly Activity[],
  cropId: number,
  isSaleType: (activityTypeId: number) => boolean,
): CropSale[] {
  return activities
    .filter((a) => a.cropId === cropId && a.status !== 'Cancelled' && isSaleType(a.activityTypeId))
    .map((a) => ({
      id: a.id,
      cropId,
      date: a.date,
      status: a.status,
      quantity: a.sale?.quantity,
      unit: a.sale?.unit,
      rate: a.sale?.rate,
      amount: a.sale?.amount,
      buyer: a.sale?.buyer,
    }));
}

/** Totals for a crop's completed sales against its expenses, over its area. */
export function summarizeSales(
  sales: readonly CropSale[],
  expenses: number,
  area: number,
  areaUnit: 'acres' | 'hectares',
): SalesSummary {
  const completed = sales.filter(isCompletedSale);
  const total = completed.reduce((sum, sale) => sum + (sale.amount ?? 0), 0);
  const profit = total - expenses;
  const acres = areaUnit === 'hectares' ? area * ACRES_PER_HECTARE : area;
  return {
    total,
    profit,
    profitPerAcre: acres > 0 ? Math.round(profit / acres) : null,
    hasCompleted: completed.length > 0,
  };
}

/** Newest sale first; undated ones last, and same-day sales keep the later one on top. */
export function sortSales(sales: readonly CropSale[]): CropSale[] {
  return [...sales].sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity) || b.id - a.id);
}
