import { CropStage, CROP_STAGES } from './crop-timeline.models';

const ONE_DAY = 24 * 60 * 60 * 1000;

/** Get the index of a stage in CROP_STAGES. Returns -1 if not found (e.g. custom stage). */
export function stageIndex(stage: CropStage | string): number {
  return CROP_STAGES.indexOf(stage as CropStage);
}

/** Calculate progress as a percentage (0–100) based on stage. Unknown stages return 0. */
export function stageProgressPercent(stage: CropStage | string): number {
  const idx = stageIndex(stage);
  return idx >= 0 ? Math.round(((idx + 1) / CROP_STAGES.length) * 100) : 0;
}

/** Calculate days elapsed since sowing. Returns null if no sowing date. */
export function daysAfterSowing(sowingDate: number | undefined): number | null {
  if (!sowingDate) return null;
  const diff = Date.now() - sowingDate;
  return isNaN(diff) ? null : Math.max(0, Math.floor(diff / ONE_DAY));
}

/** The four steps the screens show; each maps several of the eight stored stages. */
export const STAGE_STEPS = [
  'cropStages.sowing',
  'cropStages.growth',
  'cropStages.flowering',
  'cropStages.harvest',
] as const;

const STEP_BY_STAGE: Record<CropStage, number> = {
  'Land Preparation': 0,
  Sowing: 0,
  Germination: 0,
  'Vegetative Growth': 1,
  Flowering: 2,
  'Fruiting / Pod Formation': 2,
  Maturity: 3,
  Harvest: 3,
};

/** Which of the four displayed steps (0–3) a stored stage falls in; unknown stages count as the first. */
export function stageStep(stage: CropStage | string): number {
  return STEP_BY_STAGE[stage as CropStage] ?? 0;
}

/** Crop options the form offers, stored by these English values. */
export const IRRIGATION_TYPES = ['Drip', 'Sprinkler', 'Flood', 'Manual'] as const;
export const FARMING_METHODS = [
  'Organic',
  'Conventional',
  'Conservation Farming',
  'Natural Farming',
] as const;

/** Bootstrap Icons class for a crop, by its name. */
export function cropIconClass(name: string): string {
  const n = name.toLowerCase();
  const has = (words: string[]) => words.some((w) => n.includes(w));
  if (has(['maize', 'corn'])) return 'bi-flower2';
  if (has(['wheat', 'rice', 'paddy', 'bajra', 'jowar', 'barley', 'millet', 'sugarcane', 'cane'])) {
    return 'bi-tree';
  }
  if (
    has([
      'grape',
      'pomegranate',
      'banana',
      'mango',
      'orange',
      'lemon',
      'guava',
      'papaya',
      'apple',
      'fig',
      'sapota',
    ])
  ) {
    return 'bi-apple';
  }
  return 'bi-flower1';
}
