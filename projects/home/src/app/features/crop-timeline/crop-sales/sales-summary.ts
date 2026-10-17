import { CropSale } from './crop-sale.models';

const ACRES_PER_HECTARE = 2.47105;

export interface SalesSummary {
  total: number;
  /** Sales minus the crop's expenses. */
  profit: number;
  /** Profit per acre, rounded to the rupee; null when the crop has no area. */
  profitPerAcre: number | null;
}

/** Totals for a crop's sales against its expenses, over its area. */
export function summarizeSales(
  sales: readonly CropSale[],
  expenses: number,
  area: number,
  areaUnit: 'acres' | 'hectares',
): SalesSummary {
  const total = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const profit = total - expenses;
  const acres = areaUnit === 'hectares' ? area * ACRES_PER_HECTARE : area;
  return { total, profit, profitPerAcre: acres > 0 ? Math.round(profit / acres) : null };
}

/** Newest sale first; same-day sales keep the later one on top. */
export function sortSales(sales: readonly CropSale[]): CropSale[] {
  return [...sales].sort((a, b) => b.soldOn.localeCompare(a.soldOn) || b.id - a.id);
}
