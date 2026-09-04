import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SavedFarm } from '../../models/map.models';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { CropTimelineService } from '../../../features/crop-timeline/crop-timeline.service';

type LandStatus = 'planted' | 'fallow' | 'multiple';

@Component({
  selector: 'app-land-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './land-detail.component.html',
  styleUrl: './land-detail.component.scss',
})
export class LandDetailComponent {
  @Input() land: SavedFarm | null = null;
  @Output() closed = new EventEmitter<void>();

  private readonly farmDraw = inject(FarmDrawService);
  private readonly cropService = inject(CropTimelineService);

  readonly cropCosts = new Map<string, number>();
  readonly editingNotes = signal(false);
  readonly notesValue = signal('');

  readonly cropsOnLand = computed(() => {
    if (!this.land) return [];
    const crops = this.cropService.cropsForField(this.land.id);
    crops.forEach((c) => {
      this.cropCosts.set(c.id, this.cropService.costForCrop(c.id));
    });
    return crops;
  });

  readonly totalLandCost = computed(() => {
    return this.cropsOnLand().reduce((sum, c) => sum + (this.cropService.costForCrop(c.id) || 0), 0);
  });

  getLandStatus(): LandStatus {
    if (!this.land) return 'fallow';
    const count = this.cropsOnLand().length;
    if (count === 0) return 'fallow';
    if (count === 1) return 'planted';
    return 'multiple';
  }

  getStatusBadgeClass(): string {
    const status = this.getLandStatus();
    switch (status) {
      case 'planted':
        return 'status-planted';
      case 'multiple':
        return 'status-multiple';
      case 'fallow':
        return 'status-fallow';
    }
  }

  getStatusLabel(): string {
    const status = this.getLandStatus();
    switch (status) {
      case 'planted':
        return 'Planted';
      case 'multiple':
        return 'Multiple crops';
      case 'fallow':
        return 'Fallow';
    }
  }

  startEditingNotes(): void {
    this.notesValue.set(this.land?.notes || '');
    this.editingNotes.set(true);
  }

  saveNotes(): void {
    if (this.land) {
      this.farmDraw.updateFarmNotes(this.land.id, this.notesValue());
      this.editingNotes.set(false);
    }
  }

  cancelEditingNotes(): void {
    this.editingNotes.set(false);
  }
}
