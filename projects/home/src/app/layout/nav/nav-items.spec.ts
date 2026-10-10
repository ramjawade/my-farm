import { NAV_ITEMS, userInitials } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists the sections in order, with Weather outside the phone tabs', () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual([
      'home',
      'lands',
      'crops',
      'activity',
      'reports',
      'weather',
    ]);
    expect(NAV_ITEMS.filter((i) => i.phoneTab).map((i) => i.key)).toEqual([
      'home',
      'lands',
      'crops',
      'activity',
      'reports',
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
