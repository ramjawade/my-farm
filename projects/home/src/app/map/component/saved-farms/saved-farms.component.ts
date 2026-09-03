import { Component, inject, signal } from '@angular/core';
import { ConfirmDialogComponent, ToastService } from 'shared';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { FarmAreaResult } from '../../models/map.models';
import { CropTimelineService } from '../../../features/crop-timeline/crop-timeline.service';

@Component({
  standalone: true,
  selector: 'app-saved-farms',
  imports: [ConfirmDialogComponent],
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
