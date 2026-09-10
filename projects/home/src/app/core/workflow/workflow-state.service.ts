import { Injectable, signal, computed } from '@angular/core';

export type WorkflowPhase = 'registration' | 'location' | 'land' | 'crop' | 'activity' | 'report';

interface WorkflowState {
  completedPhases: WorkflowPhase[];
  currentPhase: WorkflowPhase;
  isFirstTime: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  private readonly stateSignal = signal<WorkflowState>(this.getInitialState());

  readonly completedPhases = computed(() => this.stateSignal().completedPhases);
  readonly currentPhase = computed(() => this.stateSignal().currentPhase);
  readonly isFirstTime = computed(() => this.stateSignal().isFirstTime);

  readonly progressPercent = computed(() => {
    const phases: WorkflowPhase[] = [
      'registration',
      'location',
      'land',
      'crop',
      'activity',
      'report',
    ];
    const completed = this.completedPhases().length;
    return Math.round((completed / phases.length) * 100);
  });

  readonly allPhasesComplete = computed(() => {
    const phases: WorkflowPhase[] = [
      'registration',
      'location',
      'land',
      'crop',
      'activity',
      'report',
    ];
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
    this.stateSignal.update((state) => ({
      ...state,
      completedPhases: Array.from(new Set([...state.completedPhases, phase])),
      isFirstTime: false,
    }));
  }

  updateCurrentPhase(phase: WorkflowPhase): void {
    this.stateSignal.update((state) => ({
      ...state,
      currentPhase: phase,
    }));
  }

  isPhaseComplete(phase: WorkflowPhase): boolean {
    return this.completedPhases().includes(phase);
  }

  resetWorkflow(): void {
    this.stateSignal.set(this.getInitialState());
  }

  resetForNewUser(): void {
    this.stateSignal.set(this.getInitialState());
  }
}
