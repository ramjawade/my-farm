import { Component, inject, signal } from '@angular/core';

import { formatArea, getPolygonCentroid } from '../../farm-draw/farm-area.utils';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-map-my-farm',
  templateUrl: './map-my-farm.component.html',
  styleUrl: './map-my-farm.component.scss'
})
export class MapMyFarmComponent {
  readonly draw = inject(FarmDrawService);
  private readonly authService = inject(AuthService);
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
    const nameVal = this.farmName();
    this.draw.saveFarm(nameVal);

    // Progressive Profiling: Update active user coordinates, farm name, and area if empty/default
    const user = this.authService.currentUser();
    if (user) {
      const updates: any = {};
      
      // Update coordinates
      if (!user.location) {
        // If drawing has finished, we can use the last drawn points from this.draw.points()
        const points = this.draw.points();
        const centroid = getPolygonCentroid(points);
        if (centroid) {
          updates.location = centroid;
          updates.locationType = 'map';
        }
      }

      // Update farm area
      if (user.farmArea === 0) {
        const area = this.draw.area();
        if (area) {
          updates.farmArea = area.hectares;
          updates.farmAreaUnit = 'hectares';
        }
      }

      // Update farm name
      if (nameVal && (user.farmName === `${user.fullName}'s Farm` || !user.farmName)) {
        updates.farmName = nameVal;
      }

      if (Object.keys(updates).length > 0) {
        this.authService.updateProfile(updates);
      }
    }

    this.farmName.set('');
  }
}
