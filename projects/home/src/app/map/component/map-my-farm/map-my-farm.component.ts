import { Component, inject, signal } from '@angular/core';

import { formatArea } from '../../farm-draw/farm-area.utils';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';

@Component({
  standalone: true,
  selector: 'app-map-my-farm',
  templateUrl: './map-my-farm.component.html',
  styleUrl: './map-my-farm.component.scss'
})
export class MapMyFarmComponent {
  readonly draw = inject(FarmDrawService);
  readonly farmName = signal('');

  readonly formattedArea = () => {
    const area = this.draw.area();
    return area ? formatArea(area) : null;
  };

  toggleMapMyFarm(): void {
    if (this.draw.isDrawing()) {
      this.draw.cancelDrawing();
      return;
    }
    if (this.draw.isCompleted()) {
      this.draw.startDrawing();
      return;
    }
    this.draw.startDrawing();
  }

  cancel(): void {
    this.draw.cancelDrawing();
  }

  undo(): void {
    this.draw.undoLastPoint();
  }

  onNameInput(event: Event): void {
    this.farmName.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    this.draw.saveFarm(this.farmName());
    this.farmName.set('');
  }
}
