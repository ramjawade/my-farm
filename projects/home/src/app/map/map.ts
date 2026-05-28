import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild
} from '@angular/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';
import * as L from 'leaflet';

import { FarmDrawLayer } from './farm-draw/farm-draw-layer';
import { FarmDrawPanelComponent } from './farm-draw/farm-draw-panel/farm-draw-panel';
import { FarmDrawService } from './farm-draw/farm-draw.service';
import { MapGeocodingService, MapSearchResult } from './map-geocoding.service';

type MapLayer = 'street' | 'satellite';

const SEARCH_ZOOM = 15;
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;

@Component({
  standalone: true,
  selector: 'app-map',
  imports: [FarmDrawPanelComponent],
  providers: [FarmDrawService],
  templateUrl: './map.html',
  styleUrl: './map.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private readonly geocoding = inject(MapGeocodingService);
  readonly farmDraw = inject(FarmDrawService);
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  private map?: L.Map;
  private farmDrawLayer?: FarmDrawLayer;
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.LayerGroup;
  private activeBase?: L.Layer;
  private searchMarker?: L.Marker;

  readonly activeView = signal<MapLayer>('satellite');
  readonly searchQuery = signal('');
  readonly searchResults = signal<MapSearchResult[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly showResults = signal(false);
  readonly savedFarmsCollapsed = signal(false);

  toggleSavedFarmsCollapse(): void {
    this.savedFarmsCollapsed.update((v) => !v);
  }

  onDeleteSavedFarm(event: Event, id: string): void {
    event.stopPropagation();
    this.farmDraw.deleteFarm(id);
  }

  formatFarmArea(area: any): string {
    return `${area.hectares.toFixed(2)} ha (${area.acres.toFixed(2)} ac)`;
  }

  constructor() {
    effect(() => {
      this.farmDraw.status();
      this.farmDraw.points();
      this.farmDraw.area();
      this.farmDraw.selectedSavedFarm();
      queueMicrotask(() => this.farmDrawLayer?.redraw());
    });

    effect(() => {
      const drawing = this.farmDraw.isDrawing();
      const container = this.map?.getContainer();
      container?.classList.toggle('map-drawing', drawing);
      if (drawing) {
        this.map?.doubleClickZoom.disable();
      } else {
        this.map?.doubleClickZoom.enable();
      }
    });

    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((query) => query.trim()),
        distinctUntilChanged(),
        tap((query) => {
          if (query.length === 0) {
            this.removeSearchMarker();
          }
          if (query.length < MIN_SEARCH_LENGTH) {
            this.searchResults.set([]);
            this.searchError.set(null);
            this.showResults.set(false);
            this.searchLoading.set(false);
          }
        }),
        filter((query) => query.length >= MIN_SEARCH_LENGTH),
        tap(() => {
          this.searchLoading.set(true);
          this.searchError.set(null);
          this.showResults.set(true);
        }),
        switchMap((query) =>
          this.geocoding.search(query).pipe(
            catchError(() => {
              this.searchError.set('Search failed. Try again.');
              return of([] as MapSearchResult[]);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.searchResults.set(results);
        this.searchLoading.set(false);
        if (results.length === 0) {
          this.searchError.set('No matching locations. Try a more specific address.');
        } else {
          this.searchError.set(null);
        }
      });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.farmDrawLayer?.destroy();
    this.map?.remove();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchError.set(null);
    if (!value.trim()) {
      this.clearSearch();
    } else {
      this.searchInput$.next(value);
    }
  }

  onSearchClear(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value.trim()) {
      this.clearSearch();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchNow();
    }
    if (event.key === 'Escape') {
      this.clearSearch();
    }
  }

  searchNow(): void {
    const query = this.searchQuery().trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      this.searchError.set(`Enter at least ${MIN_SEARCH_LENGTH} characters.`);
      this.showResults.set(true);
      return;
    }

    this.searchLoading.set(true);
    this.searchError.set(null);
    this.showResults.set(true);

    this.geocoding.search(query).subscribe({
      next: (results) => this.applySearchResults(results),
      error: () => {
        this.searchLoading.set(false);
        this.searchResults.set([]);
        this.searchError.set('Search failed. Try again.');
      }
    });
  }

  selectResult(result: MapSearchResult): void {
    if (!this.map) {
      return;
    }

    this.map.flyTo([result.lat, result.lon], SEARCH_ZOOM, { duration: 1.2 });

    this.removeSearchMarker();

    this.searchMarker = L.marker([result.lat, result.lon]).addTo(this.map);
    this.searchMarker
      .bindPopup(result.label)
      .on('popupclose', () => this.removeSearchMarker())
      .openPopup();

    this.closeResults();
    this.searchQuery.set(result.label);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchInput$.next('');
    this.removeSearchMarker();
    this.closeResults();
  }

  closeResults(): void {
    this.showResults.set(false);
    this.searchResults.set([]);
    this.searchError.set(null);
  }

  private removeSearchMarker(): void {
    if (!this.searchMarker || !this.map) {
      return;
    }

    this.searchMarker.off('popupclose');
    this.map.removeLayer(this.searchMarker);
    this.searchMarker = undefined;
  }

  setLayer(layer: MapLayer): void {
    if (!this.map || !this.streetLayer || !this.satelliteLayer) {
      return;
    }

    const next: L.Layer = layer === 'street' ? this.streetLayer : this.satelliteLayer;
    if (next === this.activeBase) {
      return;
    }

    if (this.activeBase) {
      this.map.removeLayer(this.activeBase);
    }
    next.addTo(this.map);
    this.activeBase = next;
    this.activeView.set(layer);
  }

  goHome(): void {
    if (this.map) {
      this.map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
    }
  }

  private applySearchResults(results: MapSearchResult[]): void {
    this.searchResults.set(results);
    this.searchLoading.set(false);
    if (results.length === 0) {
      this.searchError.set('No matching locations. Try a more specific address.');
    } else {
      this.searchError.set(null);
    }
  }

  private initMap(): void {
    const container = this.mapContainer().nativeElement;

    this.fixDefaultMarkerIcon();

    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const satelliteImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );

    const satelliteLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        pane: 'overlayPane'
      }
    );

    this.satelliteLayer = L.layerGroup([satelliteImagery, satelliteLabels]);

    this.activeBase = this.satelliteLayer;

    this.map = L.map(container, {
      center: [20.5937, 78.9629],
      zoom: 5,
      layers: [this.satelliteLayer],
      attributionControl: true,
      zoomControl: false
    });

    this.map.attributionControl?.addAttribution('Satellite imagery & labels &copy; Esri');

    // Custom native Leaflet Home Control
    const HomeControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: (map: L.Map) => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', 'leaflet-home-button', container);
        button.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-house-door-fill text-success" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
            <path d="M6.5 14.5v-3.507c0-.235.19-.425.424-.425h2.152c.234 0 .424.19.424.425v3.507c0 .235-.19.425-.424.425H6.924a.424.424 0 0 1-.424-.425z"/>
            <path d="M7.293 1.5a1 1 0 0 1 1.414 0l6.647 6.646a.5.5 0 0 1-.708.708L8 2.207 1.354 8.854a.5.5 0 1 1-.708-.708z"/>
          </svg>
        `;
        button.href = '#';
        button.title = 'Go to starting map overview';
        
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
        });
        return container;
      }
    });

    // Add Home Control first, then Zoom Control, so Zoom Control stacks natively directly above it!
    new HomeControl().addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);

    if (this.map) {
      this.farmDrawLayer = new FarmDrawLayer(this.map, this.farmDraw);
    }

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private fixDefaultMarkerIcon(): void {
    const icon = L.icon({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = icon;
  }
}
