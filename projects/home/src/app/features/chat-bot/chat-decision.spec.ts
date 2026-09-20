import { ResolvedEntry } from '../../core/api/chat-entry.service';
import {
  ClarifySource,
  EXPENSE_CATEGORIES,
  MAX_CLARIFY_ROUNDS,
  correctionSentence,
  decideNextStep,
} from './chat-decision';

function entry(overrides: Partial<ResolvedEntry> = {}): ResolvedEntry {
  return {
    transcript: '100 rs fertilizer',
    activity_type_id: 1,
    activity_type: 'Fertilizer Application',
    date: '2026-09-20',
    crop_id: 1,
    crop: 'Wheat',
    land_id: 1,
    land: 'North Plot',
    notes: null,
    expenses: [],
    dropped: [],
    ...overrides,
  };
}

const source: ClarifySource = {
  lands: [
    { id: 1, name: 'North Plot' },
    { id: 2, name: 'South Plot' },
  ],
  crops: [{ id: 1, name: 'Wheat' }],
};

describe('decideNextStep', () => {
  it('is ready when nothing is dropped and a date is present', () => {
    const { decision } = decideNextStep(entry(), {}, source);
    expect(decision.kind).toBe('ready');
  });

  it("asks for land first when land is dropped, with chips from the farmer's own lands", () => {
    const withDroppedLand = entry({
      land: null,
      land_id: null,
      dropped: [{ field: 'land', value: 'north plt', reason: 'not_found' }],
    });

    const { decision, rounds } = decideNextStep(withDroppedLand, {}, source);

    expect(decision.kind).toBe('clarify');
    if (decision.kind === 'clarify') {
      expect(decision.field).toBe('land');
      expect(decision.options).toEqual([
        { label: 'North Plot', value: '1' },
        { label: 'South Plot', value: '2' },
      ]);
    }
    expect(rounds.land).toBe(1);
  });

  it('asks for a missing date only after land/crop/category all resolve', () => {
    const { decision } = decideNextStep(entry({ date: null }), {}, source);
    expect(decision.kind).toBe('clarify');
    if (decision.kind === 'clarify') {
      expect(decision.field).toBe('date');
      expect(decision.options.map((o) => o.label)).toEqual(['Today', 'Yesterday']);
    }
  });

  it('offers all 10 known categories when an expense category is dropped', () => {
    const withDroppedCategory = entry({
      expenses: [
        {
          expense_category_id: null,
          category: 'weird stuff',
          quantity: null,
          unit: null,
          rate: null,
          amount: '100',
          remarks: null,
        },
      ],
      dropped: [{ field: 'expense_category', value: 'weird stuff', reason: 'not_found' }],
    });

    const { decision } = decideNextStep(withDroppedCategory, {}, source);
    expect(decision.kind).toBe('clarify');
    if (decision.kind === 'clarify') {
      expect(decision.field).toBe('expenseCategory');
      expect(decision.options.length).toBe(EXPENSE_CATEGORIES.length);
      expect(decision.options.map((o) => o.value)).toEqual(EXPENSE_CATEGORIES);
    }
  });

  it('escalates to the manual-form escape hatch after MAX_CLARIFY_ROUNDS failed rounds on the same field', () => {
    const stillDropped = entry({
      land: null,
      land_id: null,
      dropped: [{ field: 'land', value: 'somewhere', reason: 'not_found' }],
    });

    let rounds = {};
    let decision;
    for (let i = 0; i <= MAX_CLARIFY_ROUNDS; i++) {
      ({ decision, rounds } = decideNextStep(stillDropped, rounds, source));
    }

    expect(decision!.kind).toBe('escape');
    if (decision!.kind === 'escape') {
      expect(decision!.field).toBe('land');
      expect(decision!.entry).toBe(stillDropped);
    }
  });

  it('keeps asking (does not escalate) while still under the round limit', () => {
    const stillDropped = entry({
      land: null,
      land_id: null,
      dropped: [{ field: 'land', value: 'somewhere', reason: 'not_found' }],
    });

    const first = decideNextStep(stillDropped, {}, source);
    expect(first.decision.kind).toBe('clarify');

    const second = decideNextStep(stillDropped, first.rounds, source);
    expect(second.decision.kind).toBe('clarify');
    expect(second.rounds.land).toBe(MAX_CLARIFY_ROUNDS);
  });

  it('tracks round counts independently per field', () => {
    const droppedLandThenCrop = entry({
      land: null,
      land_id: null,
      dropped: [{ field: 'land', value: 'x', reason: 'not_found' }],
    });
    const { rounds } = decideNextStep(droppedLandThenCrop, { crop: 2 }, source);
    expect(rounds).toEqual({ crop: 2, land: 1 });
  });
});

describe('correctionSentence', () => {
  it("builds a sentence per field naming the farmer's choice", () => {
    expect(correctionSentence('land', 'North Plot')).toBe('Land: North Plot.');
    expect(correctionSentence('crop', 'Wheat')).toBe('Crop: Wheat.');
    expect(correctionSentence('expenseCategory', 'Fertilizer')).toBe(
      'Expense category: Fertilizer.',
    );
    expect(correctionSentence('date', 'Today')).toBe('Date: Today.');
  });
});
