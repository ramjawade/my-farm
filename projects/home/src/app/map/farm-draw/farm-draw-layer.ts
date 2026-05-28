import * as L from 'leaflet';
import { Subscription } from 'rxjs';

import { formatArea, getPolygonCentroid } from './farm-area.utils';
import { FarmAreaResult, LatLngPoint } from './farm-draw.models';
import { FarmDrawService } from './farm-draw.service';

const DRAWING_COLOR = '#0d6efd';
const COMPLETE_COLOR = '#198754';

const vertexStyle: L.CircleMarkerOptions = {
  radius: 8,
  color: DRAWING_COLOR,
  weight: 3,
  fillColor: '#ffffff',
  fillOpacity: 1,
  interactive: false
};

export class FarmDrawLayer {
  private readonly layerGroup = L.layerGroup();
  private areaLabel?: L.Marker;
  private readonly zoomSubscription: Subscription;

  constructor(
    private readonly map: L.Map,
    private readonly drawService: FarmDrawService
  ) {
    this.layerGroup.addTo(this.map);
    this.map.on('click', this.onMapClick);

    this.zoomSubscription = this.drawService.zoomRequest$.subscribe((farm) => {
      this.zoomToFarm(farm);
    });
  }

  destroy(): void {
    this.map.off('click', this.onMapClick);
    this.layerGroup.clearLayers();
    this.map.removeLayer(this.layerGroup);
    this.zoomSubscription.unsubscribe();
  }

  private zoomToFarm(farm: any): void {
    const latLngs = farm.points.map((p: any) => L.latLng(p.lat, p.lng));
    if (latLngs.length >= 3) {
      const poly = L.polygon(latLngs);
      this.map.fitBounds(poly.getBounds(), { padding: [50, 50], maxZoom: 17 });
    }
  }

  redraw = (): void => {
    this.layerGroup.clearLayers();
    this.areaLabel = undefined;

    const points = this.drawService.points();
    const status = this.drawService.status();
    const area = this.drawService.area();
    const selectedFarm = this.drawService.selectedSavedFarm();

    let displayPoints = points;
    let displayStatus = status;
    let displayArea = area;

    if (!this.drawService.isDrawing() && !this.drawService.isCompleted() && selectedFarm) {
      displayPoints = selectedFarm.points;
      displayStatus = 'completed';
      displayArea = selectedFarm.area;
    }

    const latLngs = displayPoints.map((p) => L.latLng(p.lat, p.lng));

    for (let i = 0; i < latLngs.length; i++) {
      const latLng = latLngs[i];
      const isFirst = i === 0;
      const isInteractive = isFirst && status === 'drawing' && this.drawService.canFinish();

      const style: L.CircleMarkerOptions = {
        ...vertexStyle,
        interactive: isInteractive,
        ...(isInteractive ? {
          radius: 11,
          color: COMPLETE_COLOR,
          weight: 4,
          fillColor: '#ffffff',
          className: 'map-drawing-finish-point'
        } : {})
      };

      const marker = L.circleMarker(latLng, style).addTo(this.layerGroup);
      if (isInteractive) {
        marker.on('click', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event.originalEvent);
          this.drawService.finishDrawing();
          this.redraw();
        });
      }
    }

    if (displayStatus === 'drawing' && latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: DRAWING_COLOR,
        weight: 3,
        dashArray: '8 6',
        interactive: false
      }).addTo(this.layerGroup);
    }

    if (displayStatus === 'completed' && latLngs.length >= 3) {
      L.polygon(latLngs, {
        color: COMPLETE_COLOR,
        weight: 3,
        fillColor: COMPLETE_COLOR,
        fillOpacity: 0.35,
        interactive: false
      }).addTo(this.layerGroup);

      const name = selectedFarm ? selectedFarm.name : 'New Farm';
      this.renderAreaLabel(displayPoints, displayArea, name);
    }

  };

  private readonly onMapClick = (event: L.LeafletMouseEvent): void => {
    if (!this.drawService.isDrawing()) {
      return;
    }

    const points = this.drawService.points();
    if (this.drawService.canFinish() && points.length > 0) {
      const clickPoint = this.map.latLngToContainerPoint(event.latlng);
      const firstLatLng = L.latLng(points[0].lat, points[0].lng);
      const firstPoint = this.map.latLngToContainerPoint(firstLatLng);
      const distance = clickPoint.distanceTo(firstPoint);

      if (distance < 22) { // Within 22 pixels of the first point
        this.drawService.finishDrawing();
        this.redraw();
        return;
      }
    }

    this.drawService.addPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    this.redraw();
  };

  private renderAreaLabel(points: LatLngPoint[], area: FarmAreaResult | null, name: string): void {
    const centroid = getPolygonCentroid(points);
    if (!centroid || !area) {
      return;
    }

    const { hectares, acres } = formatArea(area);
    const html = `<div class="farm-area-label">
      <div class="farm-area-label__name">${name}</div>
      <div class="farm-area-label__details">${hectares} ha • ${acres} acres</div>
    </div>`;

    this.areaLabel = L.marker([centroid.lat, centroid.lng], {
      icon: L.divIcon({
        className: 'farm-area-label-wrapper',
        html,
        iconSize: [220, 50],
        iconAnchor: [110, 25]
      }),
      interactive: false
    }).addTo(this.layerGroup);
  }
}
