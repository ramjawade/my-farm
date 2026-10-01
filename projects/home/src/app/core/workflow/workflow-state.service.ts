import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ActivityService } from '../../features/activity/activity.service';
import { CropTimelineService } from '../../features/crop-timeline/crop-timeline.service';

export type WorkflowPhase = 'registration' | 'location' | 'land' | 'crop' | 'activity' | 'report';

const ALL_PHASES: readonly WorkflowPhase[] = [
  'registration',
  'location',
  'land',
  'crop',
  'activity',
  'report',
];

const REPORT_FLAG_PREFIX = 'my_farm_report_generated_';

interface ExplicitMarks {
  /** The farmer these marks belong to, so one farmer's progress never shows for another. */
  userId: number | null;
  phases: WorkflowPhase[];
}

/**
 * Getting-started progress for the signed-in farmer.
 *
 * Most phases are *derived* from what the farmer actually has (an account, a saved location, crops,
 * activities), so progress is correct after a reload or a fresh sign-in and always agrees with the
 * data. Two phases cannot be derived here and are recorded when they happen: `land` (lands load
 * asynchronously, so the pages that load them report it) and `report` (nothing stores that a
 * report was generated; it is remembered per farmer on this device).
 */
@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  private readonly auth = inject(AuthService);
  private readonly cropService = inject(CropTimelineService);
  private readonly activityService = inject(ActivityService);

  private readonly marks = signal<ExplicitMarks>({ userId: null, phases: [] });
  /** Bumped when the report flag is written, since localStorage is not reactive. */
  private readonly reportFlagVersion = signal(0);

  private readonly userId = computed(() => this.auth.currentUser()?.id ?? null);

  private readonly reportGenerated = computed(() => {
    this.reportFlagVersion();
    const id = this.userId();
    return id !== null && this.readReportFlag(id);
  });

  readonly completedPhases = computed<WorkflowPhase[]>(() => {
    const user = this.auth.currentUser();
    const marked = this.marks();
    const explicit = marked.userId === this.userId() ? marked.phases : [];

    const done = new Set<WorkflowPhase>(explicit);
    if (user) done.add('registration');
    if (user?.village && user?.state) done.add('location');
    if (this.cropService.crops().length > 0) done.add('crop');
    if (this.activityService.activities().length > 0) done.add('activity');
    if (this.reportGenerated()) done.add('report');
    return ALL_PHASES.filter((phase) => done.has(phase));
  });

  readonly currentPhase = computed<WorkflowPhase>(
    () => ALL_PHASES.find((phase) => !this.completedPhases().includes(phase)) ?? 'report',
  );

  readonly allPhasesComplete = computed(() => this.completedPhases().length === ALL_PHASES.length);

  /**
   * True only before the farmer has done anything at all (e.g. signed out). Gates the one-off
   * "do this first" prompts, which must not appear for anyone who has signed in.
   */
  readonly isFirstTime = computed(() => this.completedPhases().length === 0);

  /** Whether the getting-started bar shows: a signed-in farmer with something still to do. */
  readonly showProgress = computed(() => !!this.auth.currentUser() && !this.allPhasesComplete());

  readonly progressPercent = computed(() =>
    Math.round((this.completedPhases().length / ALL_PHASES.length) * 100),
  );

  /** Record a phase that cannot be derived from data (`land`, `report`); safe to call for any. */
  markPhaseComplete(phase: WorkflowPhase): void {
    const userId = this.userId();
    if (userId === null) return;

    this.marks.update((state) => {
      const phases = state.userId === userId ? state.phases : [];
      return { userId, phases: Array.from(new Set([...phases, phase])) };
    });
    if (phase === 'report') {
      this.writeReportFlag(userId);
      this.reportFlagVersion.update((v) => v + 1);
    }
  }

  isPhaseComplete(phase: WorkflowPhase): boolean {
    return this.completedPhases().includes(phase);
  }

  /** Forget the explicit marks (derived phases follow the data and need no reset). */
  resetWorkflow(): void {
    this.marks.set({ userId: null, phases: [] });
  }

  private readReportFlag(userId: number): boolean {
    try {
      return localStorage.getItem(REPORT_FLAG_PREFIX + userId) === '1';
    } catch {
      return false;
    }
  }

  private writeReportFlag(userId: number): void {
    try {
      localStorage.setItem(REPORT_FLAG_PREFIX + userId, '1');
    } catch {
      // Private mode / storage blocked: the in-memory mark still counts for this session.
    }
  }
}
