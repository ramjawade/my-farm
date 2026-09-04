import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { FarmAreaResult, SavedFarm } from '../../models/map.models';
import { CropTimelineService } from '../../../features/crop-timeline/crop-timeline.service';
import { LandDetailComponent } from '../land-detail/land-detail.component';

type LandStatus = 'planted' | 'fallow' | 'multiple';

@Component({
  standalone: true,
  selector: 'app-saved-farms',
  imports: [CommonModule, FormsModule, ConfirmDialogComponent, LandDetailComponent],
  templateUrl: './saved-farms.component.html',
  styleUrl: './saved-farms.component.scss',
})
export class SavedFarmsComponent {
  readonly farmDraw = inject(FarmDrawService);
  private readonly crops = inject(CropTimelineService);
  private readonly toast = inject(ToastService);

  readonly savedFarmsCollapsed = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly selectedLandDetail = signal<SavedFarm | null>(null);
  readonly searchFilter = signal('');
  readonly renamingId = signal<string | null>(null);
  readonly renamingValue = signal('');

  readonly filteredFarms = computed(() => {
    const filter = this.searchFilter().toLowerCase();
    return this.farmDraw.savedFarms().filter((f) => f.name.toLowerCase().includes(filter));
  });

  toggleSavedFarmsCollapse(): void {
    this.savedFarmsCollapsed.update((v) => !v);
  }

  formatFarmArea(area: FarmAreaResult): string {
    return `${area.hectares.toFixed(2)} ha (${area.acres.toFixed(2)} ac)`;
  }

  /** Number of crops growing on a land (a land with crops cannot be deleted). */
  cropCount(landId: string): number {
    return this.crops.cropsForField(landId).length;
  }

  showLandDetail(land: SavedFarm): void {
    this.selectedLandDetail.set(land);
  }

  getLandStatus(farmId: string): LandStatus {
    const count = this.cropCount(farmId);
    if (count === 0) return 'fallow';
    if (count === 1) return 'planted';
    return 'multiple';
  }

  getStatusBadgeClass(status: LandStatus): string {
    switch (status) {
      case 'planted':
        return 'status-planted';
      case 'multiple':
        return 'status-multiple';
      case 'fallow':
        return 'status-fallow';
    }
  }

  getStatusLabel(status: LandStatus): string {
    switch (status) {
      case 'planted':
        return 'Planted';
      case 'multiple':
        return 'Multiple crops';
      case 'fallow':
        return 'Fallow';
    }
  }

  startRename(event: Event, farm: SavedFarm): void {
    event.stopPropagation();
    this.renamingId.set(farm.id);
    this.renamingValue.set(farm.name);
  }

  cancelRename(): void {
    this.renamingId.set(null);
    this.renamingValue.set('');
  }

  saveRename(id: string): void {
    const newName = this.renamingValue().trim();
    if (newName) {
      this.farmDraw.renameFarm(id, newName);
      this.toast.success('Land renamed.');
    }
    this.renamingId.set(null);
    this.renamingValue.set('');
  }

  onDeleteSavedFarm(event: Event, id: string): void {
    event.stopPropagation();
    const count = this.cropCount(id);
    if (count > 0) {
      this.toast.warning(
        `This land has ${count} crop${count > 1 ? 's' : ''} on it. Remove or move them first.`,
      );
      return;
    }
    this.pendingDeleteId.set(id);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.farmDraw.deleteFarm(id);
    this.pendingDeleteId.set(null);
    this.toast.success('Land deleted.');
  }
}
