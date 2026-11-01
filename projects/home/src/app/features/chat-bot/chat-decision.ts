import { ExpenseCategory } from '../activity/activity.models';
import { ResolvedEntry } from '../../core/api/chat-entry.service';
import { ChatQuickReply } from './chat-bot.models';
import { isSaleEntry, saleNumbersOf } from './chat-sale';

/**
 * Fields the chat can ask the farmer to clarify. `land`/`crop`/`expenseCategory`
 * come from the backend's `dropped` list (#242); `date` is a client-side check
 * since the backend never rejects or reports a date.
 */
export type ClarifyField =
  'land' | 'crop' | 'expenseCategory' | 'date' | 'saleQuantity' | 'saleRate';

/** Priority order: ask about one field at a time, most useful first. */
const CLARIFY_ORDER: ClarifyField[] = ['land', 'crop', 'expenseCategory', 'date'];

/**
 * A sale cannot be saved without a crop, a quantity with a unit and a rate or total, so those are
 * asked first. Land is not asked: the crop fixes it.
 */
const SALE_CLARIFY_ORDER: ClarifyField[] = [
  'crop',
  'saleQuantity',
  'saleRate',
  'expenseCategory',
  'date',
];

/** The two questions that take a typed answer rather than a chip. */
export function isSaleField(field: ClarifyField): boolean {
  return field === 'saleQuantity' || field === 'saleRate';
}

const DROPPED_FIELD_NAME: Record<'land' | 'crop' | 'expenseCategory', string> = {
  land: 'land',
  crop: 'crop',
  expenseCategory: 'expense_category',
};

/** The 10 categories `/activities/parse` and the manual form both recognise. */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Machine Rent',
  'Labour',
  'Seeds',
  'Fertilizer',
  'Pesticide',
  'Transport',
  'Water',
  'Equipment',
  'Fuel',
  'Other',
];

/** After this many failed rounds on the same field, offer the manual form. */
export const MAX_CLARIFY_ROUNDS = 2;

export type RoundCounts = Partial<Record<ClarifyField, number>>;

export interface ClarifySource {
  lands: { id: number; name: string }[];
  crops: { id: number; name: string }[];
}

export interface ReadyDecision {
  kind: 'ready';
  entry: ResolvedEntry;
}

export interface ClarifyDecision {
  kind: 'clarify';
  field: ClarifyField;
  options: ChatQuickReply[];
}

export interface EscapeDecision {
  kind: 'escape';
  field: ClarifyField;
  entry: ResolvedEntry;
}

export type Decision = ReadyDecision | ClarifyDecision | EscapeDecision;

export interface DecisionResult {
  decision: Decision;
  rounds: RoundCounts;
}

function isMissing(entry: ResolvedEntry, field: ClarifyField): boolean {
  if (field === 'date') return !entry.date;
  if (field === 'saleQuantity') {
    const { quantity } = saleNumbersOf(entry);
    return quantity === null || !entry.sale_unit?.trim();
  }
  if (field === 'saleRate') {
    const { rate, amount } = saleNumbersOf(entry);
    return rate === null && amount === null;
  }
  // A sale needs its crop even when nothing was named; other entries only ask when a name failed.
  if (field === 'crop' && isSaleEntry(entry) && entry.crop_id === null) return true;
  const droppedName = DROPPED_FIELD_NAME[field];
  return entry.dropped.some((d) => d.field === droppedName);
}

function optionsFor(field: ClarifyField, source: ClarifySource): ChatQuickReply[] {
  switch (field) {
    case 'land':
      return source.lands.map((l) => ({ label: l.name, value: String(l.id) }));
    case 'crop':
      return source.crops.map((c) => ({ label: c.name, value: String(c.id) }));
    case 'expenseCategory':
      return EXPENSE_CATEGORIES.map((c) => ({ label: c, value: c }));
    case 'saleQuantity':
    case 'saleRate':
      return []; // typed answers
    case 'date':
      return [
        { label: 'Today', value: new Date().toISOString().slice(0, 10) },
        { label: 'Yesterday', value: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) },
      ];
  }
}

/**
 * Decide what the bot does next, given the latest parse and how many times
 * each field has already been asked about. Pure — no HTTP, no Angular, no
 * DOM — so this is the layer #258 asked to be covered by unit tests
 * independent of any component.
 */
export function decideNextStep(
  entry: ResolvedEntry,
  rounds: RoundCounts,
  source: ClarifySource,
): DecisionResult {
  const order = isSaleEntry(entry) ? SALE_CLARIFY_ORDER : CLARIFY_ORDER;
  const field = order.find((f) => isMissing(entry, f));

  if (!field) {
    return { decision: { kind: 'ready', entry }, rounds };
  }

  const nextRounds: RoundCounts = { ...rounds, [field]: (rounds[field] ?? 0) + 1 };

  if (nextRounds[field]! > MAX_CLARIFY_ROUNDS) {
    return { decision: { kind: 'escape', field, entry }, rounds: nextRounds };
  }

  return {
    decision: { kind: 'clarify', field, options: optionsFor(field, source) },
    rounds: nextRounds,
  };
}

/** The sentence appended to the accumulated text when a chip is tapped. */
export function correctionSentence(field: ClarifyField, chosenLabel: string): string {
  switch (field) {
    case 'land':
      return `Land: ${chosenLabel}.`;
    case 'crop':
      return `Crop: ${chosenLabel}.`;
    case 'expenseCategory':
      return `Expense category: ${chosenLabel}.`;
    case 'date':
      return `Date: ${chosenLabel}.`;
    case 'saleQuantity':
      return `Sale quantity and unit: ${chosenLabel}.`;
    case 'saleRate':
      return `Sale rate or total: ${chosenLabel}.`;
  }
}
