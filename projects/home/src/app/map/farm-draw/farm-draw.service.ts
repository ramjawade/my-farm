import { computed, Injectable, signal, inject } from '@angular/core';
import { Subject } from 'rxjs';

import { calculateFarmArea, toGeoJsonPolygon } from './farm-area.utils';
import {
  FarmAreaResult,
  FarmDrawStatus,
  LatLngPoint,
  NewSavedFarm,
  SavedFarm,
} from '../models/map.models';
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
  loadFarms(userId: number): Promise<SavedFarm[]> {
    return this.storage.getFarms(userId);
  }

  private persistFarmUpdate(id: number, updates: Partial<SavedFarm>): void {
    const user = this.authService.currentUser();
    if (user) {
      this.storage
        .updateFarm(user.id, id, updates)
        .catch((e) => console.error('Failed to update farm', e));
    }
  }

  private persistFarmDelete(id: number): void {
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

  /**
   * Persist a new farm from the current drawing. Resolves with the saved farm
   * (server-minted id), or null if the drawing isn't valid or nobody is signed in.
   * The drawing is kept if the save fails, so the farmer can retry.
   */
  async saveFarm(name: string, currentFarms: SavedFarm[]): Promise<SavedFarm | null> {
    const user = this.authService.currentUser();
    if (!user || !this.isCompleted()) {
      return null;
    }
    const currentArea = this.area();
    const currentPoints = this.points();
    if (!currentArea || currentPoints.length < 3) {
      return null;
    }

    const draft: NewSavedFarm = {
      name: name.trim() || `Farm #${currentFarms.length + 1}`,
      points: currentPoints,
      area: currentArea,
      geoJson: toGeoJsonPolygon(currentPoints),
    };

    const saved = await this.storage.saveFarm(user.id, draft);
    this.cancelDrawing();
    return saved;
  }

  deleteFarm(id: number): void {
    this.persistFarmDelete(id);
  }

  /** Returns the updated farm, or null if the name is blank or the farm isn't found. */
  renameFarm(id: number, newName: string, currentFarms: SavedFarm[]): SavedFarm | null {
    const trimmed = newName.trim();
    if (!trimmed) return null;
    const updated = currentFarms.find((f) => f.id === id);
    if (!updated) return null;
    this.persistFarmUpdate(id, { name: trimmed });
    return { ...updated, name: trimmed };
  }

  /** Returns the updated farm, or null if not found. */
  updateFarmNotes(id: number, notes: string, currentFarms: SavedFarm[]): SavedFarm | null {
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
