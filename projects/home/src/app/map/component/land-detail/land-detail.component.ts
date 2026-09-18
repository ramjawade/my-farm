import { Component, inject, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SavedFarm } from '../../models/map.models';
import { CropTimelineService } from '../../../features/crop-timeline/crop-timeline.service';
import { ReferenceNamePipe } from '../../../core/i18n/reference-name.pipe';

type LandStatus = 'planted' | 'fallow' | 'multiple';

@Component({
  selector: 'app-land-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ReferenceNamePipe],
  templateUrl: './land-detail.component.html',
  styleUrl: './land-detail.component.scss',
})
export class LandDetailComponent {
  readonly land = input<SavedFarm | null>(null);
  readonly closed = output<void>();
  readonly notesUpdated = output<{ id: number; notes: string }>();

  private readonly cropService = inject(CropTimelineService);
  private readonly translate = inject(TranslateService);

  readonly cropCosts = new Map<number, number>();
  readonly editingNotes = signal(false);
  readonly notesValue = signal('');

  readonly cropsOnLand = computed(() => {
    const land = this.land();
    if (!land) return [];
    const crops = this.cropService.cropsForField(land.id);
    crops.forEach((c) => {
      this.cropCosts.set(c.id, this.cropService.costForCrop(c.id));
    });
    return crops;
  });

  readonly totalLandCost = computed(() => {
    return this.cropsOnLand().reduce(
      (sum, c) => sum + (this.cropService.costForCrop(c.id) || 0),
      0,
    );
  });

  getLandStatus(): LandStatus {
    if (!this.land()) return 'fallow';
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
        return this.translate.instant('savedFarms.planted');
      case 'multiple':
        return this.translate.instant('savedFarms.multipleCrops');
      case 'fallow':
        return this.translate.instant('savedFarms.fallow');
    }
  }

  startEditingNotes(): void {
    this.notesValue.set(this.land()?.notes || '');
    this.editingNotes.set(true);
  }

  saveNotes(): void {
    const land = this.land();
    if (land) {
      this.notesUpdated.emit({ id: land.id, notes: this.notesValue() });
      this.editingNotes.set(false);
    }
  }

  cancelEditingNotes(): void {
    this.editingNotes.set(false);
  }
}
