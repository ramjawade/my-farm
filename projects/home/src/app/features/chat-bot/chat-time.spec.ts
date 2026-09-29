import { dayHeading, localDay } from './chat-time';

describe('localDay', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 8, 30, 0, 1))).toBe('2026-09-30');
  });
});

describe('dayHeading', () => {
  const now = new Date(2026, 8, 30, 12, 0);

  it('calls today "today"', () => {
    expect(dayHeading('2026-09-30', now)).toEqual({ kind: 'today' });
  });

  it('calls the day before "yesterday", across a month boundary too', () => {
    expect(dayHeading('2026-09-29', now)).toEqual({ kind: 'yesterday' });
    expect(dayHeading('2026-09-30', new Date(2026, 9, 1))).toEqual({ kind: 'yesterday' });
  });

  it('spells out any other day as a local date, not a UTC one', () => {
    const heading = dayHeading('2026-09-01', now);

    expect(heading.kind).toBe('date');
    if (heading.kind === 'date') {
      expect(heading.label).toContain('2026');
      expect(heading.label).toContain('1');
    }
  });
});
