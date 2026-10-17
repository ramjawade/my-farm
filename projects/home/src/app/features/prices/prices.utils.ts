import { CropPricesResponse, MandiPriceResponse } from '../../core/api/contracts';

/** One row of the Prices page: a crop type, however many plantings of it the farmer has. */
export interface CropTypeRow {
  catalogId: number;
  /** The mandi feed's commodity name; null when the crop has no price commodity. */
  commodity: string | null;
  mandis: MandiPriceResponse[];
  /** Every planting of this crop type, so a row can link to the crop to edit. */
  cropIds: number[];
}

/**
 * The read API returns one entry per planting, so two onion plantings arrive as two
 * identical entries. Group them by crop type, keeping the order of first appearance.
 */
export function groupByCropType(crops: readonly CropPricesResponse[]): CropTypeRow[] {
  const rows = new Map<number, CropTypeRow>();
  for (const crop of crops) {
    const row = rows.get(crop.crop_catalog_id);
    if (row) {
      row.cropIds.push(crop.crop_id);
    } else {
      rows.set(crop.crop_catalog_id, {
        catalogId: crop.crop_catalog_id,
        commodity: crop.commodity ?? null,
        mandis: crop.mandis,
        cropIds: [crop.crop_id],
      });
    }
  }
  return [...rows.values()];
}

export function hasPrice(
  entry: MandiPriceResponse,
): entry is MandiPriceResponse & { price: number } {
  return typeof entry.price === 'number';
}

/** Priced mandis from the highest price down, then the ones that do not trade the crop. */
export function rankMandis(mandis: readonly MandiPriceResponse[]): MandiPriceResponse[] {
  const priced = mandis.filter(hasPrice).sort((a, b) => b.price - a.price);
  return [...priced, ...mandis.filter((m) => !hasPrice(m))];
}

export type RowKind = 'noPrice' | 'notTraded' | 'priced';

export interface RowSummary {
  kind: RowKind;
  /** The highest-priced mandi, for a priced row. */
  best?: MandiPriceResponse & { price: number };
  ranked: MandiPriceResponse[];
}

export function summarizeRow(row: CropTypeRow): RowSummary {
  const ranked = rankMandis(row.mandis);
  if (row.commodity === null) return { kind: 'noPrice', ranked };
  const best = ranked.find(hasPrice);
  return best ? { kind: 'priced', best, ranked } : { kind: 'notTraded', ranked };
}

export type ChangeDirection = 'up' | 'down' | 'flat' | 'none';

export function changeDirection(pct: number | null | undefined): ChangeDirection {
  if (pct === null || pct === undefined) return 'none';
  if (pct > 0) return 'up';
  if (pct < 0) return 'down';
  return 'flat';
}

/** How much lower a mandi's price is than the best one, as a positive rupee amount. */
export function gapFromBest(price: number, best: number): number {
  return Math.max(0, Math.round(best - price));
}

/** Local calendar date as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True when the reading is from an earlier day than `today`. */
export function isStale(priceDate: string | null | undefined, today: string = todayIso()): boolean {
  return !!priceDate && priceDate < today;
}

export type AverageBadge = 'below' | 'near' | 'above';

/** Below or above the average by more than 3% is "below" or "above"; otherwise "near". */
export function averageBadge(price: number, average: number): AverageBadge {
  if (average <= 0) return 'near';
  const deviation = ((price - average) / average) * 100;
  if (deviation < -3) return 'below';
  if (deviation > 3) return 'above';
  return 'near';
}

export interface LinePoint {
  date: string;
  price: number;
}

/** The change over a period for the compare legend: first to last point, in percent. */
export function periodChange(points: readonly LinePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  return first ? Math.round(((last - first) / first) * 1000) / 10 : null;
}
