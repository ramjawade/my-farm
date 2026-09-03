import { computed, Injectable, signal, inject, effect } from '@angular/core';
import { Subject } from 'rxjs';

import { calculateFarmArea, toGeoJsonPolygon } from './farm-area.utils';
import { FarmAreaResult, FarmDrawStatus, LatLngPoint, SavedFarm } from '../models/map.models';
import { AuthService } from '../../core/auth/auth.service';
import { IStorageService } from '../../core/storage/storage.interface';

@Injectable({ providedIn: 'root' })
export class FarmDrawService {
  private readonly authService = inject(AuthService);
  private readonly storage = inject(IStorageService);
  private generation = 0;

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
        this.loadSavedFarms(user.id);
      } else {
        this.savedFarms.set([]);
        this.selectedSavedFarm.set(null);
      }
    });
  }

  /** Re-read the signed-in user's lands from storage. */
  reload(): Promise<void> {
    const user = this.authService.currentUser();
    return user ? this.loadSavedFarms(user.id) : Promise.resolve();
  }

  private async loadSavedFarms(userId: string): Promise<void> {
    const generation = ++this.generation;
    try {
      const farms = await this.storage.getFarms(userId);
      if (generation !== this.generation) return;
      this.savedFarms.set(farms);
    } catch (e) {
      console.error('Failed to load saved farms', e);
      this.savedFarms.set([]);
    }
  }

  /** Apply a land mutation and persist it for the signed-in user. */
  private setFarms(farms: SavedFarm[]): void {
    this.generation++;
    this.savedFarms.set(farms);
    const user = this.authService.currentUser();
    if (user) {
      this.storage.saveFarms(user.id, farms).catch((e) => console.error('Failed to save farms', e));
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
      createdAt: Date.now(),
    };

    this.setFarms([newFarm, ...this.savedFarms()]);

    this.selectedSavedFarm.set(newFarm);
    this.cancelDrawing();
  }

  deleteFarm(id: string): void {
    this.setFarms(this.savedFarms().filter((f) => f.id !== id));
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
