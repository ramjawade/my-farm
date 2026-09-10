import { Injectable, signal, computed } from '@angular/core';
import { WorkflowStateService, WorkflowPhase } from './workflow-state.service';

interface PromptState {
  dismissedPhases: Set<WorkflowPhase>;
}

@Injectable({ providedIn: 'root' })
export class OnboardingGuideService {
  private readonly promptState = signal<PromptState>({ dismissedPhases: new Set() });

  readonly dismissedPhases = computed(() => this.promptState().dismissedPhases);

  shouldShowPrompt(phase: WorkflowPhase): boolean {
    return !this.dismissedPhases().has(phase);
  }

  dismissPrompt(phase: WorkflowPhase): void {
    this.promptState.update((state) => ({
      ...state,
      dismissedPhases: new Set([...state.dismissedPhases, phase]),
    }));
  }

  resetPrompts(): void {
    this.promptState.set({ dismissedPhases: new Set() });
  }
}
