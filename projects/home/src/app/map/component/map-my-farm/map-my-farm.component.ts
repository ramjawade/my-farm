import { Component, inject, signal, computed, output, effect } from '@angular/core';

import { formatArea, getPolygonCentroid } from '../../farm-draw/farm-area.utils';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from 'shared';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { OnboardingGuideService } from '../../../core/workflow/onboarding-guide.service';
import { WorkflowPromptCardComponent } from '../../../features/shared/components/workflow-prompt-card.component';

@Component({
  standalone: true,
  imports: [WorkflowPromptCardComponent],
  selector: 'app-map-my-farm',
  templateUrl: './map-my-farm.component.html',
  styleUrl: './map-my-farm.component.scss',
})
export class MapMyFarmComponent {
  readonly draw = inject(FarmDrawService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly onboardingService = inject(OnboardingGuideService);
  readonly farmName = signal('');
  readonly setSatelliteLayer = output<void>();
  readonly locateMeRequest = output<void>();
  readonly geolocating = signal(false);

  readonly shouldShowLandPrompt = computed(() => {
    const hasNoFarms = this.draw.savedFarms().length === 0;
    const promptNotDismissed = this.onboardingService.shouldShowPrompt('land');
    return hasNoFarms && promptNotDismissed && this.workflowService.isFirstTime();
  });

  readonly formattedArea = () => {
    const area = this.draw.area();
    return area ? formatArea(area) : null;
  };

  constructor() {
    effect(() => {
      if (this.draw.isDrawing()) {
        this.setSatelliteLayer.emit();
      }
    });
  }

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

  locateMe(): void {
    if (!navigator.geolocation) {
      this.toast.warning('Geolocation is not supported by your browser.');
      return;
    }

    this.geolocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locateMeRequest.emit();
        this.geolocating.set(false);
      },
      (error) => {
        this.geolocating.set(false);
        const message =
          error.code === 1
            ? 'Please enable location access in your browser settings.'
            : 'Unable to get your location. Please try again.';
        this.toast.warning(message);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  onNameInput(event: Event): void {
    this.farmName.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    const nameVal = this.farmName();
    this.draw.saveFarm(nameVal);
    this.toast.success(`Land "${nameVal.trim() || 'Farm'}" saved.`);

    // Mark land workflow phase complete
    this.workflowService.markPhaseComplete('land');
    this.onboardingService.dismissPrompt('land');

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

  onLandPromptAction(): void {
    this.toggleMapMyFarm();
  }

  onLandPromptDismiss(): void {
    this.onboardingService.dismissPrompt('land');
  }
}
