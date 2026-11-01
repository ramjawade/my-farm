import { ResolvedEntry } from '../../core/api/chat-entry.service';
import { completeSaleNumbers, isSaleEntry, positiveNumber, saleNumbersOf } from './chat-sale';

const entry = (over: Partial<ResolvedEntry> = {}): ResolvedEntry => ({
  transcript: 't',
  activity_type_id: 9,
  activity_type: 'Sale',
  date: null,
  crop_id: null,
  crop: null,
  land_id: null,
  land: null,
  notes: null,
  expenses: [],
  dropped: [],
  ...over,
});

describe('positiveNumber', () => {
  it('reads decimal strings and numbers above zero', () => {
    expect(positiveNumber('1250.00')).toBe(1250);
    expect(positiveNumber(12)).toBe(12);
  });

  it('treats blank, zero, negative, null and text as not said', () => {
    for (const value of ['', '0', '-3', null, undefined, 'abc']) {
      expect(positiveNumber(value)).toBeNull();
    }
  });
});

describe('completeSaleNumbers', () => {
  it('works out the amount from quantity and rate', () => {
    expect(completeSaleNumbers({ quantity: 12, rate: 1250, amount: null })).toEqual({
      quantity: 12,
      rate: 1250,
      amount: 15000,
    });
  });

  it('works out the rate from a stated total', () => {
    expect(completeSaleNumbers({ quantity: 12, rate: null, amount: 15000 })).toEqual({
      quantity: 12,
      rate: 1250,
      amount: 15000,
    });
  });

  it('keeps a stated total even when quantity and rate would give another', () => {
    expect(completeSaleNumbers({ quantity: 10, rate: 1100, amount: 10500 }).amount).toBe(10500);
  });

  it('rounds to the paisa', () => {
    expect(completeSaleNumbers({ quantity: 3, rate: null, amount: 100 }).rate).toBe(33.33);
  });

  it('leaves it alone when there is nothing to work from', () => {
    const said = { quantity: null, rate: 1250, amount: null };
    expect(completeSaleNumbers(said)).toEqual(said);
  });
});

describe('sale helpers on an entry', () => {
  it('recognises a Sale by its type name', () => {
    expect(isSaleEntry(entry())).toBeTrue();
    expect(isSaleEntry(entry({ activity_type: 'Irrigation' }))).toBeFalse();
  });

  it('takes the numbers from the API strings and completes them', () => {
    expect(
      saleNumbersOf(entry({ sale_quantity: '12.00', sale_rate: '1250.00', sale_amount: null })),
    ).toEqual({ quantity: 12, rate: 1250, amount: 15000 });
  });

  it('gives nothing for an entry without sale fields', () => {
    expect(saleNumbersOf(entry())).toEqual({ quantity: null, rate: null, amount: null });
  });
});
