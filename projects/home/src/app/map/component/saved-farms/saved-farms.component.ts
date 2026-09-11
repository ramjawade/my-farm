import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent, ToastService } from 'shared';
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
  readonly farms = input.required<SavedFarm[]>();
  readonly selected = input<SavedFarm | null>(null);

  readonly selectFarm = output<SavedFarm>();
  readonly renameFarm = output<{ id: number; newName: string }>();
  readonly deleteFarm = output<number>();
  readonly updateNotes = output<{ id: number; notes: string }>();

  private readonly crops = inject(CropTimelineService);
  private readonly toast = inject(ToastService);

  readonly savedFarmsCollapsed = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly pendingDeleteId = signal<number | null>(null);
  readonly selectedLandDetailId = signal<number | null>(null);
  readonly selectedLandDetail = computed(
    () => this.farms().find((f) => f.id === this.selectedLandDetailId()) ?? null,
  );
  readonly searchFilter = signal('');
  readonly renamingId = signal<number | null>(null);
  readonly renamingValue = signal('');

  readonly filteredFarms = computed(() => {
    const filter = this.searchFilter().toLowerCase();
    return this.farms().filter((f) => f.name.toLowerCase().includes(filter));
  });

  toggleSavedFarmsCollapse(): void {
    this.savedFarmsCollapsed.update((v) => !v);
  }

  formatFarmArea(area: FarmAreaResult): string {
    return `${area.hectares.toFixed(2)} ha (${area.acres.toFixed(2)} ac)`;
  }

  /** Number of crops growing on a land (a land with crops cannot be deleted). */
  cropCount(landId: number): number {
    return this.crops.cropsForField(landId).length;
  }

  showLandDetail(land: SavedFarm): void {
    this.selectedLandDetailId.set(land.id);
  }

  getLandStatus(farmId: number): LandStatus {
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

  saveRename(id: number): void {
    const newName = this.renamingValue().trim();
    if (newName) {
      this.renameFarm.emit({ id, newName });
      this.toast.success('Land renamed.');
    }
    this.renamingId.set(null);
    this.renamingValue.set('');
  }

  onDeleteSavedFarm(event: Event, id: number): void {
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
    this.deleteFarm.emit(id);
    this.pendingDeleteId.set(null);
    this.toast.success('Land deleted.');
  }

  onLandNotesUpdated(event: { id: number; notes: string }): void {
    this.updateNotes.emit(event);
  }
}
