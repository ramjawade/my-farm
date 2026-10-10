import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { SavedFarm } from '../../../map/models/map.models';

const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SELECTED_COLOR = 'var(--mf-map-select)';
const LAND_COLOR = 'var(--mf-map-done)';

/** A read-only map of the saved lands; the selected one is highlighted and a tap selects another. */
@Component({
  selector: 'app-home-farm-map',
  template: `<div
    #map
    class="rounded-3 overflow-hidden w-100"
    style="height: 240px"
    role="img"
    [attr.aria-label]="label()"
  ></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeFarmMapComponent implements OnDestroy {
  readonly lands = input.required<SavedFarm[]>();
  readonly selectedId = input<number | null>(null);
  /** The second label line per land id, such as its crops. */
  readonly details = input<Record<number, string>>({});
  /** Accessible description of the map. */
  readonly label = input('');
  readonly selectLand = output<number>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly ready = signal(false);
  private map?: L.Map;
  private readonly layer = L.layerGroup();
  private fittedTo?: SavedFarm[];

  constructor() {
    afterNextRender(() => this.init());
    effect(() => {
      const lands = this.lands();
      const selectedId = this.selectedId();
      const details = this.details();
      if (this.ready()) this.draw(lands, selectedId, details);
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    // Late callbacks (the first invalidateSize) must not touch a removed map.
    this.map = undefined;
  }

  private init(): void {
    const map = L.map(this.host().nativeElement, {
      center: [20.5937, 78.9629],
      zoom: 5,
      layers: [L.tileLayer(SATELLITE_URL, { maxZoom: 19 })],
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    this.layer.addTo(map);
    this.map = map;
    this.ready.set(true);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private draw(lands: SavedFarm[], selectedId: number | null, details: Record<number, string>) {
    const map = this.map;
    if (!map) return;
    this.layer.clearLayers();
    const all: L.LatLng[] = [];
    for (const land of lands) {
      const points = land.points.map((p) => L.latLng(p.lat, p.lng));
      if (points.length < 3) continue;
      all.push(...points);
      const selected = land.id === selectedId;
      const polygon = L.polygon(points, {
        color: selected ? SELECTED_COLOR : LAND_COLOR,
        weight: selected ? 4 : 2,
        fillColor: selected ? SELECTED_COLOR : LAND_COLOR,
        fillOpacity: selected ? 0.5 : 0.3,
      }).addTo(this.layer);
      polygon.on('click', () => this.selectLand.emit(land.id));
      L.marker(polygon.getBounds().getCenter(), {
        icon: L.divIcon({ className: '', html: this.labelFor(land, details[land.id]) }),
        interactive: false,
      }).addTo(this.layer);
    }
    if (all.length && this.fittedTo !== lands) {
      this.fittedTo = lands;
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 17 });
    }
  }

  /** Built from DOM nodes so a land name is never read as markup. */
  private labelFor(land: SavedFarm, detail?: string): HTMLElement {
    const chip = document.createElement('div');
    // White text with a dark outline on the imagery, name over detail, as in the prototype.
    chip.style.cssText =
      'position:absolute;transform:translate(-50%,-50%);width:max-content;max-width:160px;' +
      'text-align:center;line-height:1.25;pointer-events:none;color:var(--mf-map-fill);' +
      '-webkit-text-stroke:3px var(--bs-black);paint-order:stroke fill';
    const name = document.createElement('div');
    name.style.cssText = 'font-size:12px;font-weight:700';
    name.textContent = land.name;
    chip.append(name);
    if (detail) {
      const line = document.createElement('div');
      line.style.cssText = 'font-size:11px;font-weight:500';
      line.textContent = detail;
      chip.append(line);
    }
    return chip;
  }
}
