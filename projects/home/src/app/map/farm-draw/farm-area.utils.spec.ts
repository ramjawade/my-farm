import { toGeoJsonPolygon, calculateFarmArea, getPolygonCentroid, formatArea } from './farm-area.utils';
import { LatLngPoint, FarmAreaResult } from '../models/map.models';

describe('farm-area.utils', () => {
  const mockSquarePoints: LatLngPoint[] = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 1, lng: 1 },
    { lat: 0, lng: 1 }
  ];

  describe('toGeoJsonPolygon', () => {
    it('should convert point array to complete closed geojson polygon feature', () => {
      const feature = toGeoJsonPolygon(mockSquarePoints);

      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.geometry.coordinates[0].length).toBe(5); // 4 points + closed ring point
      expect(feature.geometry.coordinates[0][4]).toEqual([0, 0]); // Closes at starting coordinates
    });
  });

  describe('calculateFarmArea', () => {
    it('should return null if points length is less than 3', () => {
      const area = calculateFarmArea([{ lat: 0, lng: 0 }]);
      expect(area).toBeNull();
    });

    it('should calculate valid hectares and acres for a mock polygon', () => {
      const area = calculateFarmArea(mockSquarePoints);

      expect(area).not.toBeNull();
      expect(area!.squareMeters).toBeGreaterThan(0);
      expect(area!.hectares).toBe(area!.squareMeters / 10_000);
      expect(area!.acres).toBe(area!.squareMeters / 4_046.8564224);
    });
  });

  describe('getPolygonCentroid', () => {
    it('should return null if points length is less than 3', () => {
      const centroid = getPolygonCentroid([{ lat: 0, lng: 0 }]);
      expect(centroid).toBeNull();
    });

    it('should compute approximate centroid coordinates', () => {
      const centroid = getPolygonCentroid(mockSquarePoints);

      expect(centroid).not.toBeNull();
      expect(centroid!.lat).toBeCloseTo(0.5, 1);
      expect(centroid!.lng).toBeCloseTo(0.5, 1);
    });
  });

  describe('formatArea', () => {
    it('should format FarmAreaResult values to 2 decimal string representations', () => {
      const mockAreaResult: FarmAreaResult = {
        squareMeters: 100000,
        hectares: 10.456,
        acres: 25.834
      };

      const formatted = formatArea(mockAreaResult);

      expect(formatted.hectares).toBe('10.46');
      expect(formatted.acres).toBe('25.83');
    });
  });
});
