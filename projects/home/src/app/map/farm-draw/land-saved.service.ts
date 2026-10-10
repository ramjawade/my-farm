import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { AuthService } from '../../core/auth/auth.service';
import { OnboardingGuideService } from '../../core/workflow/onboarding-guide.service';
import { WorkflowStateService } from '../../core/workflow/workflow-state.service';
import { getPolygonCentroid } from './farm-area.utils';
import { SavedFarm } from '../models/map.models';

/** What happens around a newly saved land: toast, onboarding steps and progressive profiling. */
@Injectable({ providedIn: 'root' })
export class LandSavedService {
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly workflowService = inject(WorkflowStateService);
  private readonly onboardingService = inject(OnboardingGuideService);
  private readonly translate = inject(TranslateService);

  handle(land: SavedFarm): void {
    this.toast.success(this.translate.instant('mapMyFarm.landSavedToast', { name: land.name }));
    this.workflowService.markPhaseComplete('land');
    this.onboardingService.dismissPrompt('land');

    const user = this.authService.currentUser();
    if (!user) return;
    const updates: Record<string, unknown> = {};

    if (!user.location) {
      const centroid = getPolygonCentroid(land.points);
      if (centroid) {
        updates['location'] = centroid;
        updates['locationType'] = 'map';
      }
    }
    if (user.farmArea === 0 && land.area.hectares > 0) {
      updates['farmArea'] = land.area.hectares;
      updates['farmAreaUnit'] = 'hectares';
    }
    if (land.name && (user.farmName === `${user.fullName}'s Farm` || !user.farmName)) {
      updates['farmName'] = land.name;
    }

    if (Object.keys(updates).length > 0) {
      this.authService
        .updateProfile(updates)
        .catch((e) => console.error('Failed to save farm details', e));
    }
  }
}
