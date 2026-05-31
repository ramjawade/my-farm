import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
  Input,
  output
} from '@angular/core';
import * as L from 'leaflet';

import { FarmDrawLayer } from './farm-draw/farm-draw-layer';
import { MapMyFarmComponent } from './component/map-my-farm/map-my-farm.component';
import { FarmDrawService } from './farm-draw/farm-draw.service';
import { MapSearchResult } from './models/map.models';
import { HomeControl, LayerToggleControl } from './controls';
import { MapSearchComponent } from './component/map-search/map-search.component';
import { SavedFarmsComponent } from './component/saved-farms/saved-farms.component';

type MapLayer = 'street' | 'satellite';

const SEARCH_ZOOM = 15;

@Component({
  standalone: true,
  selector: 'app-map',
  imports: [MapMyFarmComponent, MapSearchComponent, SavedFarmsComponent],
  templateUrl: './map.html',
  styleUrl: './map.scss'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @Input() isPicker = false;
  @Input() showSearch = false;
  @Input() mapMode: 'pin' | 'draw' = 'pin';

  readonly mapReady = output<L.Map>();
  readonly pinCoordinatesSelected = output<{ lat: number; lng: number }>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  readonly farmDraw = inject(FarmDrawService);

  private map?: L.Map;
  private farmDrawLayer?: FarmDrawLayer;
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.LayerGroup;
  private activeBase?: L.Layer;
  private searchMarker?: L.Marker;

  readonly activeView = signal<MapLayer>('satellite');

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
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.farmDrawLayer?.destroy();
    this.map?.remove();
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

    if (this.isPicker) {
      this.pinCoordinatesSelected.emit({ lat: result.lat, lng: result.lon });
    }
  }

  clearSearch(): void {
    this.removeSearchMarker();
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

    // Synchronize custom Leaflet Layer Toggle control icon if it exists in DOM
    const toggleButton = document.querySelector('.leaflet-layer-toggle-button');
    if (toggleButton && toggleButton.parentElement && (toggleButton.parentElement as any)._updateUI) {
      (toggleButton.parentElement as any)._updateUI(layer);
    }
  }

  goHome(): void {
    if (this.map) {
      this.map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
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

    // this.map.attributionControl?.addAttribution('Satellite imagery & labels &copy; Esri');
    this.map.attributionControl?.setPrefix(false);

    // Add native Leaflet Controls imported from map-controls.ts
    new HomeControl().addTo(this.map);
    if (!this.isPicker) {
      new LayerToggleControl({
        activeView: () => this.activeView(),
        setLayer: (layer) => this.setLayer(layer)
      }).addTo(this.map);
    }

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);

    if (this.map) {
      this.farmDrawLayer = new FarmDrawLayer(this.map, this.farmDraw);
      this.mapReady.emit(this.map);

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        if (this.isPicker && this.mapMode === 'pin') {
          this.pinCoordinatesSelected.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
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
