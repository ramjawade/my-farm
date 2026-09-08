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

  private persistNewFarm(farm: SavedFarm): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage.saveFarm(user.id, farm).catch((e) => console.error('Failed to save farm', e));
    }
  }

  private persistFarmUpdate(id: string, updates: Partial<SavedFarm>): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage
        .updateFarm(user.id, id, updates)
        .catch((e) => console.error('Failed to update farm', e));
    }
  }

  private persistFarmDelete(id: string): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage.deleteFarm(user.id, id).catch((e) => console.error('Failed to delete farm', e));
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
      id: crypto.randomUUID(),
      name: name.trim() || `Farm #${this.savedFarms().length + 1}`,
      points: currentPoints,
      area: currentArea,
      geoJson: toGeoJsonPolygon(currentPoints),
      createdAt: Date.now(),
    };

    this.generation++;
    this.savedFarms.set([newFarm, ...this.savedFarms()]);
    this.persistNewFarm(newFarm);

    this.selectedSavedFarm.set(newFarm);
    this.cancelDrawing();
  }

  deleteFarm(id: string): void {
    this.generation++;
    this.savedFarms.set(this.savedFarms().filter((f) => f.id !== id));
    this.persistFarmDelete(id);
    if (this.selectedSavedFarm()?.id === id) {
      this.selectedSavedFarm.set(null);
    }
  }

  renameFarm(id: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    this.generation++;
    const farms = this.savedFarms().map((f) => (f.id === id ? { ...f, name: trimmed } : f));
    this.savedFarms.set(farms);
    this.persistFarmUpdate(id, { name: trimmed });
    const updated = farms.find((f) => f.id === id);
    if (updated) {
      this.selectedSavedFarm.set(updated);
    }
  }

  updateFarmNotes(id: string, notes: string): void {
    this.generation++;
    const farms = this.savedFarms().map((f) => (f.id === id ? { ...f, notes } : f));
    this.savedFarms.set(farms);
    this.persistFarmUpdate(id, { notes });
    const updated = farms.find((f) => f.id === id);
    if (updated) {
      this.selectedSavedFarm.set(updated);
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
