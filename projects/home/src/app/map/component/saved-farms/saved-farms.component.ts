import { Component, inject, signal } from '@angular/core';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { FarmAreaResult } from '../../models/map.models';

@Component({
  standalone: true,
  selector: 'app-saved-farms',
  templateUrl: './saved-farms.component.html',
  styleUrl: './saved-farms.component.scss'
})
export class SavedFarmsComponent {
  readonly farmDraw = inject(FarmDrawService);
  readonly savedFarmsCollapsed = signal(false);

  toggleSavedFarmsCollapse(): void {
    this.savedFarmsCollapsed.update((v) => !v);
  }

  formatFarmArea(area: FarmAreaResult): string {
    return `${area.hectares.toFixed(2)} ha (${area.acres.toFixed(2)} ac)`;
  }

  onDeleteSavedFarm(event: Event, id: string): void {
    event.stopPropagation();
    this.farmDraw.deleteFarm(id);
  }
}
