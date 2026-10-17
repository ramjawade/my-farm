import { NAV_ITEMS, userInitials } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists the sections in order, with Weather outside the phone tabs and Prices as the sixth tab', () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual([
      'home',
      'lands',
      'crops',
      'activity',
      'reports',
      'prices',
      'weather',
    ]);
    expect(NAV_ITEMS.filter((i) => i.phoneTab).map((i) => i.key)).toEqual([
      'home',
      'lands',
      'crops',
      'activity',
      'reports',
      'prices',
    ]);
  });
});

describe('userInitials', () => {
  it('uses first and last initial', () => {
    expect(userInitials('Ram Jawade')).toBe('RJ');
    expect(userInitials('ram kumar jawade')).toBe('RJ');
  });

  it('handles single-word, blank and missing names', () => {
    expect(userInitials('ram')).toBe('R');
    expect(userInitials('   ')).toBe('U');
    expect(userInitials(null)).toBe('U');
    expect(userInitials(undefined)).toBe('U');
  });
});
