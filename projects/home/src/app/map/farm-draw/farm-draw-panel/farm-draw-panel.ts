import { Component, inject, signal } from '@angular/core';

import { formatArea } from '../farm-area.utils';
import { FarmDrawService } from '../farm-draw.service';

@Component({
  standalone: true,
  selector: 'app-farm-draw-panel',
  templateUrl: './farm-draw-panel.html',
  styleUrl: './farm-draw-panel.scss'
})
export class FarmDrawPanelComponent {
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
