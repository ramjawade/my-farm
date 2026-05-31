import { LatLngPoint } from '../../map/models/map.models';

export interface FarmerRegistrationData {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  preferredLanguage: string;
  userRole: string; // 'Farmer', 'Farm Owner', 'Agronomist', 'Farm Worker', 'Student', 'Researcher', 'Gardener'
  farmName: string;
  farmArea: number;
  farmAreaUnit: 'acres' | 'hectares';
  primaryCrops: string[];
  waterSource: string;
  irrigationType: string;
  farmingMethod: string;
  locationType: 'map' | 'manual' | 'skipped';
  state?: string;
  district?: string;
  village?: string;
  pincode?: string;
  location: LatLngPoint | null;
  createdAt: number;
}
