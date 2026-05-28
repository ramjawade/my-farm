import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

export const MAP_SEARCH_RESULT_LIMIT = 5;

export interface MapSearchResult {
  id: string;
  rank: number;
  label: string;
  subtitle: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

@Injectable({ providedIn: 'root' })
export class MapGeocodingService {
  private readonly http = inject(HttpClient);

  search(query: string): Observable<MapSearchResult[]> {
    const trimmed = query.trim();
    return this.http
      .get<PhotonResponse>('https://photon.komoot.io/api/', {
        params: { q: trimmed, limit: String(MAP_SEARCH_RESULT_LIMIT), lang: 'en' }
      })
      .pipe(
        map((response) =>
          response.features.slice(0, MAP_SEARCH_RESULT_LIMIT).map((feature, index) => {
            const { label, subtitle } = this.formatResult(feature.properties);
            return {
              id: `${feature.geometry.coordinates.join(',')}-${index}`,
              rank: index + 1,
              label,
              subtitle,
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0]
            };
          })
        )
      );
  }

  private formatResult(properties: Record<string, string | undefined>): {
    label: string;
    subtitle: string;
  } {
    const name = properties['name'];
    const street = [properties['housenumber'], properties['street']].filter(Boolean).join(' ');
    const locality = [properties['city'] ?? properties['town'] ?? properties['village'], properties['state']]
      .filter(Boolean)
      .join(', ');

    const label =
      name ??
      (street ? `${street}${locality ? `, ${locality}` : ''}` : locality || 'Unknown location');

    const type = properties['type'] ?? properties['osm_value'];
    const country = properties['country'];
    const postcode = properties['postcode'];
    const subtitle = [type, postcode, country].filter(Boolean).join(' · ');

    return { label, subtitle: subtitle || 'Location' };
  }
}
