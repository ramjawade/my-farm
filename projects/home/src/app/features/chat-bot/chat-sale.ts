import { ResolvedEntry } from '../../core/api/chat-entry.service';

/** The type name the assistant uses for a sale. */
export const SALE_TYPE = 'Sale';

export interface SaleNumbers {
  quantity: number | null;
  rate: number | null;
  amount: number | null;
}

/** A positive number from an API decimal string or a form value; anything else is "not said". */
export function positiveNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const cents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Fill in the figure the farmer did not say, never one they did: the amount is quantity times
 * rate, or, when only a total was said, the rate is amount divided by quantity.
 */
export function completeSaleNumbers(said: SaleNumbers): SaleNumbers {
  const { quantity, rate, amount } = said;
  if (quantity && rate && !amount) return { quantity, rate, amount: cents(quantity * rate) };
  if (quantity && amount && !rate) return { quantity, rate: cents(amount / quantity), amount };
  return said;
}

export function isSaleEntry(entry: ResolvedEntry): boolean {
  return entry.activity_type === SALE_TYPE;
}

/** The entry's sale numbers, completed from what was said. */
export function saleNumbersOf(entry: ResolvedEntry): SaleNumbers {
  return completeSaleNumbers({
    quantity: positiveNumber(entry.sale_quantity),
    rate: positiveNumber(entry.sale_rate),
    amount: positiveNumber(entry.sale_amount),
  });
}
