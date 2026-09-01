import { computed, Injectable, signal, inject, effect } from '@angular/core';
import { Subject } from 'rxjs';

import { calculateFarmArea, toGeoJsonPolygon } from './farm-area.utils';
import { FarmAreaResult, FarmDrawStatus, LatLngPoint, SavedFarm } from '../models/map.models';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class FarmDrawService {
  private readonly authService = inject(AuthService);

  readonly status = signal<FarmDrawStatus>('idle');
  readonly points = signal<LatLngPoint[]>([]);
  readonly area = signal<FarmAreaResult | null>(null);

  // Saved Farms state
  readonly savedFarms = signal<SavedFarm[]>([]);
  readonly selectedSavedFarm = signal<SavedFarm | null>(null);

  readonly isDrawing = computed(() => this.status() === 'drawing');
  readonly isCompleted = computed(() => this.status() === 'completed');
  readonly canFinish = computed(() => this.points().length >= 3);
  readonly pointCount = computed(() => this.points().length);

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        const loaded = this.loadSavedFarms(user.id);
        this.savedFarms.set(loaded);
      } else {
        this.savedFarms.set([]);
        this.selectedSavedFarm.set(null);
      }
    });
  }

  private getSavedFarmsKey(): string {
    const user = this.authService.currentUser();
    return user ? `my_farm_${user.id}_saved_farms` : 'saved_farms';
  }

  private loadSavedFarms(userId: string): SavedFarm[] {
    try {
      const key = `my_farm_${userId}_saved_farms`;
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }

      // Seed default user if empty
      if (userId === 'f-default') {
        return this.seedDefaultSavedFarm();
      }
      return [];
    } catch {
      return [];
    }
  }

  private seedDefaultSavedFarm(): SavedFarm[] {
    const center = { lat: 20.5937, lng: 78.9629 };
    const points = [
      { lat: center.lat - 0.003, lng: center.lng - 0.003 },
      { lat: center.lat - 0.003, lng: center.lng + 0.003 },
      { lat: center.lat + 0.003, lng: center.lng + 0.003 },
      { lat: center.lat + 0.003, lng: center.lng - 0.003 }
    ];
    const defaultFarm: SavedFarm = {
      id: 'default-farm-1',
      name: 'Green Valley Main Plot',
      points: points,
      area: { hectares: 6.5, acres: 16.06, squareMeters: 65000 },
      geoJson: toGeoJsonPolygon(points),
      createdAt: Date.now()
    };
    const farms = [defaultFarm];
    try {
      localStorage.setItem('my_farm_f-default_saved_farms', JSON.stringify(farms));
    } catch (e) {
      console.error('Failed to save default farm', e);
    }
    return farms;
  }

  private saveToStorage(farms: SavedFarm[]): void {
    try {
      localStorage.setItem(this.getSavedFarmsKey(), JSON.stringify(farms));
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
