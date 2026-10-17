import { CropPricesResponse, MandiPriceResponse } from '../../core/api/contracts';
import {
  averageBadge,
  changeDirection,
  gapFromBest,
  groupByCropType,
  isStale,
  periodChange,
  rankMandis,
  summarizeRow,
  todayIso,
} from './prices.utils';

const mandi = (id: number, price: number | null, extra: Partial<MandiPriceResponse> = {}) =>
  ({
    mandi: { id, name: `M${id}`, district: 'Nashik' },
    price,
    ...extra,
  }) as MandiPriceResponse;

const crop = (
  cropId: number,
  catalogId: number,
  commodity: string | null,
  mandis: MandiPriceResponse[],
) => ({ crop_id: cropId, crop_catalog_id: catalogId, commodity, mandis }) as CropPricesResponse;

describe('groupByCropType', () => {
  it('turns two plantings of one crop into one row, in order of first appearance', () => {
    const onion = [mandi(1, 2150)];
    const rows = groupByCropType([
      crop(10, 5, 'Onion', onion),
      crop(11, 7, 'Wheat', [mandi(1, 2400)]),
      crop(12, 5, 'Onion', onion),
    ]);
    expect(rows.map((r) => r.catalogId)).toEqual([5, 7]);
    expect(rows[0].commodity).toBe('Onion');
  });

  it('keeps a crop with no price commodity as a row with a null commodity', () => {
    const rows = groupByCropType([crop(1, 9, null, [mandi(1, null)])]);
    expect(rows).toEqual([{ catalogId: 9, commodity: null, mandis: [mandi(1, null)] }]);
  });
});

describe('rankMandis', () => {
  it('puts the highest price first and the mandis that do not trade it last', () => {
    const ranked = rankMandis([mandi(1, null), mandi(2, 2040), mandi(3, 2150)]);
    expect(ranked.map((m) => m.mandi.id)).toEqual([3, 2, 1]);
  });
});

describe('summarizeRow', () => {
  it('names the best mandi for a priced crop', () => {
    const s = summarizeRow({
      catalogId: 1,
      commodity: 'Onion',
      mandis: [mandi(1, 2040), mandi(2, 2150)],
    });
    expect(s.kind).toBe('priced');
    expect(s.best?.mandi.id).toBe(2);
  });

  it('is "not traded" when no chosen mandi has a price', () => {
    expect(summarizeRow({ catalogId: 1, commodity: 'Onion', mandis: [mandi(1, null)] }).kind).toBe(
      'notTraded',
    );
  });

  it('is "no price" when the crop has no price commodity', () => {
    expect(summarizeRow({ catalogId: 1, commodity: null, mandis: [mandi(1, null)] }).kind).toBe(
      'noPrice',
    );
  });
});

describe('changeDirection', () => {
  it('reads up, down, flat and none', () => {
    expect(changeDirection(6.4)).toBe('up');
    expect(changeDirection(-1.2)).toBe('down');
    expect(changeDirection(0)).toBe('flat');
    expect(changeDirection(null)).toBe('none');
    expect(changeDirection(undefined)).toBe('none');
  });
});

describe('gapFromBest', () => {
  it('is the rupees below the best, never negative', () => {
    expect(gapFromBest(2040, 2150)).toBe(110);
    expect(gapFromBest(2150, 2150)).toBe(0);
    expect(gapFromBest(2200, 2150)).toBe(0);
  });
});

describe('todayIso and isStale', () => {
  it('writes the local date with padding', () => {
    expect(todayIso(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('treats only an earlier day as stale', () => {
    expect(isStale('2026-10-14', '2026-10-17')).toBeTrue();
    expect(isStale('2026-10-17', '2026-10-17')).toBeFalse();
    expect(isStale(null, '2026-10-17')).toBeFalse();
  });
});

describe('averageBadge', () => {
  it('is below or above when more than 3% off the average, else near', () => {
    expect(averageBadge(950, 1000)).toBe('below');
    expect(averageBadge(1050, 1000)).toBe('above');
    expect(averageBadge(1030, 1000)).toBe('near');
    expect(averageBadge(970, 1000)).toBe('near');
    expect(averageBadge(969, 1000)).toBe('below');
  });

  it('is near when there is no usable average', () => {
    expect(averageBadge(100, 0)).toBe('near');
  });
});

describe('periodChange', () => {
  it('is the first-to-last change in percent, or null for under two points', () => {
    expect(
      periodChange([
        { date: '2026-10-10', price: 2000 },
        { date: '2026-10-17', price: 2150 },
      ]),
    ).toBe(7.5);
    expect(periodChange([{ date: '2026-10-17', price: 2150 }])).toBeNull();
    expect(periodChange([])).toBeNull();
  });
});
