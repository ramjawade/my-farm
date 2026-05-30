export interface MapSearchResult {
  id: string;
  rank: number;
  label: string;
  subtitle: string;
  lat: number;
  lon: number;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface FarmAreaResult {
  squareMeters: number;
  hectares: number;
  acres: number;
}

export interface SavedFarm {
  id: string;
  name: string;
  points: LatLngPoint[];
  area: FarmAreaResult;
  geoJson: any;
  createdAt: number;
}

export type FarmDrawStatus = 'idle' | 'drawing' | 'completed';
