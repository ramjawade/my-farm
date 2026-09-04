import { Injectable, signal, computed } from '@angular/core';
import { WorkflowStateService, WorkflowPhase } from './workflow-state.service';

interface PromptState {
  dismissedPhases: Set<WorkflowPhase>;
}

@Injectable({ providedIn: 'root' })
export class OnboardingGuideService {
  private readonly getPromptState = (): PromptState => {
    const stored = localStorage.getItem('mf-prompt-state');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          dismissedPhases: new Set(parsed.dismissedPhases || []),
        };
      } catch {
        return { dismissedPhases: new Set() };
      }
    }
    return { dismissedPhases: new Set() };
  };

  private readonly promptState = signal<PromptState>(this.getPromptState());

  readonly dismissedPhases = computed(() => this.promptState().dismissedPhases);

  shouldShowPrompt(phase: WorkflowPhase): boolean {
    return !this.dismissedPhases().has(phase);
  }

  dismissPrompt(phase: WorkflowPhase): void {
    this.promptState.update((state) => {
      const updated = {
        ...state,
        dismissedPhases: new Set([...state.dismissedPhases, phase]),
      };
      localStorage.setItem(
        'mf-prompt-state',
        JSON.stringify({ dismissedPhases: Array.from(updated.dismissedPhases) }),
      );
      return updated;
    });
  }

  resetPrompts(): void {
    this.promptState.set({ dismissedPhases: new Set() });
    localStorage.removeItem('mf-prompt-state');
  }
}
