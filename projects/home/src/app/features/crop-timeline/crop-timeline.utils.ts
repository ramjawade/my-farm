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
