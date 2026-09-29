/** `YYYY-MM-DD` in the farmer's own timezone (not UTC — a brief is "today" where they are). */
export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export type DayHeading =
  { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; label: string };

/** What to print above a run of messages sent on `day`, relative to `now`. */
export function dayHeading(day: string, now: Date = new Date()): DayHeading {
  if (day === localDay(now)) return { kind: 'today' };

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDay(yesterday)) return { kind: 'yesterday' };

  // `day` is a local calendar date, so build it as one — `new Date('YYYY-MM-DD')` would be UTC.
  const [year, month, date] = day.split('-').map(Number);
  const label = new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return { kind: 'date', label };
}
