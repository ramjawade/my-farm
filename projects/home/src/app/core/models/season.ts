/** Indian cropping seasons. Canonical values used by crops, activities and reports. */
export type Season = 'Kharif' | 'Rabi' | 'Zaid';

export const SEASONS: readonly Season[] = ['Kharif', 'Rabi', 'Zaid'];

/**
 * Derive the cropping season from a date.
 * Kharif: Jun–Oct (monsoon), Rabi: Nov–Mar (winter), Zaid: Apr–May (summer).
 */
export function seasonForDate(date: number | Date = Date.now()): Season {
  const d = typeof date === 'number' ? new Date(date) : date;
  const month = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  if (month >= 5 && month <= 9) return 'Kharif';
  if (month === 3 || month === 4) return 'Zaid';
  return 'Rabi';
}

/** Normalise legacy free-text season values (e.g. "Summer") to the canonical union. */
export function normalizeSeason(value: string | undefined | null): Season | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'kharif') return 'Kharif';
  if (v === 'rabi') return 'Rabi';
  if (v === 'zaid' || v === 'summer') return 'Zaid';
  return undefined;
}
