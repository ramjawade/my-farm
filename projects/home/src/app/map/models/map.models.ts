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
  id: number;
  name: string;
  points: LatLngPoint[];
  area: FarmAreaResult;
  geoJson: any;
  createdAt: number;
  notes?: string;
}

export type NewSavedFarm = Omit<SavedFarm, 'id' | 'createdAt'>;

export type FarmDrawStatus = 'idle' | 'drawing' | 'completed';
