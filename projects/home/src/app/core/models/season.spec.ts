import { normalizeSeason, seasonForDate } from './season';

describe('season helpers', () => {
  it('derives season from month', () => {
    expect(seasonForDate(new Date(2026, 6, 15))).toBe('Kharif'); // July
    expect(seasonForDate(new Date(2026, 11, 1))).toBe('Rabi'); // December
    expect(seasonForDate(new Date(2026, 1, 1))).toBe('Rabi'); // February
    expect(seasonForDate(new Date(2026, 3, 20))).toBe('Zaid'); // April
  });

  it('normalises legacy values', () => {
    expect(normalizeSeason('Summer')).toBe('Zaid');
    expect(normalizeSeason('kharif')).toBe('Kharif');
    expect(normalizeSeason('')).toBeUndefined();
    expect(normalizeSeason('Monsoon')).toBeUndefined();
  });
});
