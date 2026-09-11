import { computed, Injectable, signal, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { calculateFarmArea, toGeoJsonPolygon } from './farm-area.utils';
import { FarmAreaResult, FarmDrawStatus, LatLngPoint, SavedFarm } from '../models/map.models';
import { AuthService } from '../../core/auth/auth.service';
import { IStorageService } from '../../core/storage/storage.interface';

@Injectable({ providedIn: 'root' })
export class FarmDrawService {
  private readonly authService = inject(AuthService);
  private readonly storage = inject(IStorageService);

  readonly status = signal<FarmDrawStatus>('idle');
  readonly points = signal<LatLngPoint[]>([]);
  readonly area = signal<FarmAreaResult | null>(null);

  readonly isDrawing = computed(() => this.status() === 'drawing');
  readonly isCompleted = computed(() => this.status() === 'completed');
  readonly canFinish = computed(() => this.points().length >= 3);
  readonly pointCount = computed(() => this.points().length);

  /** Read the signed-in user's lands from storage. */
  loadFarms(userId: string): Promise<SavedFarm[]> {
    return this.storage.getFarms(userId);
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

  /** Build and persist a new farm from the current drawing; returns it, or null if the drawing isn't valid. */
  saveFarm(name: string, currentFarms: SavedFarm[]): SavedFarm | null {
    if (!this.isCompleted()) {
      return null;
    }
    const currentArea = this.area();
    const currentPoints = this.points();
    if (!currentArea || currentPoints.length < 3) {
      return null;
    }

    const newFarm: SavedFarm = {
      id: crypto.randomUUID(),
      name: name.trim() || `Farm #${currentFarms.length + 1}`,
      points: currentPoints,
      area: currentArea,
      geoJson: toGeoJsonPolygon(currentPoints),
      createdAt: Date.now(),
    };

    this.persistNewFarm(newFarm);
    this.cancelDrawing();
    return newFarm;
  }

  deleteFarm(id: string): void {
    this.persistFarmDelete(id);
  }

  /** Returns the updated farm, or null if the name is blank or the farm isn't found. */
  renameFarm(id: string, newName: string, currentFarms: SavedFarm[]): SavedFarm | null {
    const trimmed = newName.trim();
    if (!trimmed) return null;
    const updated = currentFarms.find((f) => f.id === id);
    if (!updated) return null;
    this.persistFarmUpdate(id, { name: trimmed });
    return { ...updated, name: trimmed };
  }

  /** Returns the updated farm, or null if not found. */
  updateFarmNotes(id: string, notes: string, currentFarms: SavedFarm[]): SavedFarm | null {
    const found = currentFarms.find((f) => f.id === id);
    if (!found) return null;
    this.persistFarmUpdate(id, { notes });
    return { ...found, notes };
  }

  readonly zoomRequest$ = new Subject<SavedFarm>();

  /** Side effects of selecting a farm on the map (cancel any in-progress drawing, zoom to it). */
  notifyFarmSelected(farm: SavedFarm | null): void {
    if (farm) {
      this.cancelDrawing();
      this.zoomRequest$.next(farm);
    }
  }
}
