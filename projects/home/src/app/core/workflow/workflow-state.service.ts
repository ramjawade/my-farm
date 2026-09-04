import { Injectable, signal, computed } from '@angular/core';

export type WorkflowPhase = 'registration' | 'location' | 'land' | 'crop' | 'activity' | 'report';

interface WorkflowState {
  completedPhases: WorkflowPhase[];
  currentPhase: WorkflowPhase;
  isFirstTime: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  private readonly stateSignal = signal<WorkflowState>(() => {
    const stored = localStorage.getItem('mf-workflow-state');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.getInitialState();
      }
    }
    return this.getInitialState();
  }());

  readonly completedPhases = computed(() => this.stateSignal().completedPhases);
  readonly currentPhase = computed(() => this.stateSignal().currentPhase);
  readonly isFirstTime = computed(() => this.stateSignal().isFirstTime);

  readonly progressPercent = computed(() => {
    const phases: WorkflowPhase[] = ['registration', 'location', 'land', 'crop', 'activity', 'report'];
    const completed = this.completedPhases().length;
    return Math.round((completed / phases.length) * 100);
  });

  readonly allPhasesComplete = computed(() => {
    const phases: WorkflowPhase[] = ['registration', 'location', 'land', 'crop', 'activity', 'report'];
    return this.completedPhases().length === phases.length;
  });

  private getInitialState(): WorkflowState {
    return {
      completedPhases: [],
      currentPhase: 'registration',
      isFirstTime: true,
    };
  }

  markPhaseComplete(phase: WorkflowPhase): void {
    this.stateSignal.update((state) => {
      const updated = {
        ...state,
        completedPhases: Array.from(new Set([...state.completedPhases, phase])),
        isFirstTime: false,
      };
      localStorage.setItem('mf-workflow-state', JSON.stringify(updated));
      return updated;
    });
  }

  updateCurrentPhase(phase: WorkflowPhase): void {
    this.stateSignal.update((state) => {
      const updated = { ...state, currentPhase: phase };
      localStorage.setItem('mf-workflow-state', JSON.stringify(updated));
      return updated;
    });
  }

  isPhaseComplete(phase: WorkflowPhase): boolean {
    return this.completedPhases().includes(phase);
  }

  resetWorkflow(): void {
    const initial = this.getInitialState();
    this.stateSignal.set(initial);
    localStorage.removeItem('mf-workflow-state');
  }

  resetForNewUser(): void {
    const initial = this.getInitialState();
    this.stateSignal.set(initial);
    localStorage.setItem('mf-workflow-state', JSON.stringify(initial));
  }
}
