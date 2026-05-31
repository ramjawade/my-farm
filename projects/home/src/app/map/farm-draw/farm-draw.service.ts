import { computed, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

import { calculateFarmArea, toGeoJsonPolygon } from './farm-area.utils';
import { FarmAreaResult, FarmDrawStatus, LatLngPoint, SavedFarm } from '../models/map.models';

@Injectable({ providedIn: 'root' })
export class FarmDrawService {
  readonly status = signal<FarmDrawStatus>('idle');
  readonly points = signal<LatLngPoint[]>([]);
  readonly area = signal<FarmAreaResult | null>(null);

  // Saved Farms state
  readonly savedFarms = signal<SavedFarm[]>(this.loadSavedFarms());
  readonly selectedSavedFarm = signal<SavedFarm | null>(null);

  readonly isDrawing = computed(() => this.status() === 'drawing');
  readonly isCompleted = computed(() => this.status() === 'completed');
  readonly canFinish = computed(() => this.points().length >= 3);
  readonly pointCount = computed(() => this.points().length);

  private loadSavedFarms(): SavedFarm[] {
    try {
      const data = localStorage.getItem('saved_farms');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(farms: SavedFarm[]): void {
    try {
      localStorage.setItem('saved_farms', JSON.stringify(farms));
    } catch (e) {
      console.error('Could not save to localStorage', e);
    }
  }

  startDrawing(): void {
    this.status.set('drawing');
    this.points.set([]);
    this.area.set(null);
    this.selectedSavedFarm.set(null);
  }

  addPoint(point: LatLngPoint): void {
    if (this.status() !== 'drawing') {
      return;
    }
    this.points.update((current) => [...current, point]);
  }

  finishDrawing(): void {
    if (!this.canFinish()) {
      return;
    }

    const result = calculateFarmArea(this.points());
    if (!result) {
      return;
    }

    this.area.set(result);
    this.status.set('completed');
  }

  cancelDrawing(): void {
    this.status.set('idle');
    this.points.set([]);
    this.area.set(null);
  }

  undoLastPoint(): void {
    if (this.status() !== 'drawing' || this.points().length === 0) {
      return;
    }
    this.points.update((current) => current.slice(0, -1));
  }

  saveFarm(name: string): void {
    if (!this.isCompleted()) {
      return;
    }
    const currentArea = this.area();
    const currentPoints = this.points();
    if (!currentArea || currentPoints.length < 3) {
      return;
    }

    const newFarm: SavedFarm = {
      id: Math.random().toString(36).substring(2, 9),
      name: name.trim() || `Farm #${this.savedFarms().length + 1}`,
      points: currentPoints,
      area: currentArea,
      geoJson: toGeoJsonPolygon(currentPoints),
      createdAt: Date.now()
    };

    this.savedFarms.update((current) => {
      const updated = [newFarm, ...current];
      this.saveToStorage(updated);
      return updated;
    });

    this.selectedSavedFarm.set(newFarm);
    this.cancelDrawing();
  }

  deleteFarm(id: string): void {
    this.savedFarms.update((current) => {
      const updated = current.filter((f) => f.id !== id);
      this.saveToStorage(updated);
      return updated;
    });
    if (this.selectedSavedFarm()?.id === id) {
      this.selectedSavedFarm.set(null);
    }
  }

  readonly zoomRequest$ = new Subject<SavedFarm>();

  selectFarm(farm: SavedFarm | null): void {
    this.selectedSavedFarm.set(farm);
    if (farm) {
      this.cancelDrawing();
      this.zoomRequest$.next(farm);
    }
  }
}
