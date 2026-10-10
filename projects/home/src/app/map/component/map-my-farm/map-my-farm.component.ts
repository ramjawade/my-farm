import { Component, inject, input, signal, computed, output, effect } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { formatArea } from '../../farm-draw/farm-area.utils';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { ToastService } from 'shared';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { OnboardingGuideService } from '../../../core/workflow/onboarding-guide.service';
import { WorkflowPromptCardComponent } from '../../../features/shared/components/workflow-prompt-card.component';

@Component({
  standalone: true,
  imports: [WorkflowPromptCardComponent, TranslatePipe],
  selector: 'app-map-my-farm',
  templateUrl: './map-my-farm.component.html',
  styleUrl: './map-my-farm.component.scss',
})
export class MapMyFarmComponent {
  readonly draw = inject(FarmDrawService);
  private readonly toast = inject(ToastService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly onboardingService = inject(OnboardingGuideService);
  private readonly translate = inject(TranslateService);
  readonly hasFarms = input(false);

  readonly setSatelliteLayer = output<void>();
  readonly locateMeRequest = output<void>();
  readonly geolocating = signal(false);

  readonly shouldShowLandPrompt = computed(() => {
    const promptNotDismissed = this.onboardingService.shouldShowPrompt('land');
    return !this.hasFarms() && promptNotDismissed && this.workflowService.isFirstTime();
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
      this.toast.warning(this.translate.instant('mapMyFarm.geolocationUnsupported'));
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
            ? this.translate.instant('mapMyFarm.enableLocation')
            : this.translate.instant('mapMyFarm.locationUnavailable');
        this.toast.warning(message);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  onLandPromptAction(): void {
    this.toggleMapMyFarm();
  }

  onLandPromptDismiss(): void {
    this.onboardingService.dismissPrompt('land');
  }
}
