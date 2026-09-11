/** Parse a numeric entity id from a route or query param; null when absent or malformed. */
export function parseId(value: string | null | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
