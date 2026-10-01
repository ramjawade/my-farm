/** Mean of a polygon's vertices; `null` for an empty polygon. */
export function centroidOf(
  points: readonly { lat: number; lng: number }[],
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}
