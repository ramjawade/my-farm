/** Water sources a land can have, stored by these English values. */
export const LAND_WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Farm Pond', 'Rainfed'] as const;

/** Translation key for a stored water source; unknown values have no key. */
export function waterSourceKey(value: string): string {
  return 'lands.water.' + value.replace(/\s+/g, '');
}
