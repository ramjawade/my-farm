import { geoArea, geoCentroid } from 'd3';

import { FarmAreaResult, LatLngPoint } from '../models/map.models';

const EARTH_RADIUS_M = 6378137;

interface GeoPolygonFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
}

export function toGeoJsonPolygon(points: LatLngPoint[]): GeoPolygonFeature {
  const ring = points.map((p) => [p.lng, p.lat] as [number, number]);
  ring.push(ring[0]);

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    }
  };
}

export function calculateFarmArea(points: LatLngPoint[]): FarmAreaResult | null {
  if (points.length < 3) {
    return null;
  }

  const feature = toGeoJsonPolygon(points);
  const steradians = geoArea(feature);
  const squareMeters = steradians * EARTH_RADIUS_M * EARTH_RADIUS_M;

  return {
    squareMeters,
    hectares: squareMeters / 10_000,
    acres: squareMeters / 4_046.8564224
  };
}

export function getPolygonCentroid(points: LatLngPoint[]): LatLngPoint | null {
  if (points.length < 3) {
    return null;
  }

  const [lng, lat] = geoCentroid(toGeoJsonPolygon(points));
  return { lat, lng };
}

export function formatArea(area: FarmAreaResult): { hectares: string; acres: string } {
  return {
    hectares: area.hectares.toFixed(2),
    acres: area.acres.toFixed(2)
  };
}
