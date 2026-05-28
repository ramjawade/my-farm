export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface FarmAreaResult {
  squareMeters: number;
  hectares: number;
  acres: number;
}

export type FarmDrawStatus = 'idle' | 'drawing' | 'completed';

export interface SavedFarm {
  id: string;
  name: string;
  points: LatLngPoint[];
  area: FarmAreaResult;
  geoJson: any;
  createdAt: number;
}
