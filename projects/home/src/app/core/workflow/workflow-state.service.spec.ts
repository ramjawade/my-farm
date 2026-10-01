import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WorkflowStateService } from './workflow-state.service';
import { AuthService } from '../auth/auth.service';
import { ActivityService } from '../../features/activity/activity.service';
import { CropTimelineService } from '../../features/crop-timeline/crop-timeline.service';

describe('WorkflowStateService', () => {
  const currentUser = signal<{ id: number; village?: string; state?: string } | null>(null);
  const crops = signal<unknown[]>([]);
  const activities = signal<unknown[]>([]);

  function create(): WorkflowStateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: { currentUser } },
        { provide: CropTimelineService, useValue: { crops } },
        { provide: ActivityService, useValue: { activities } },
      ],
    });
    return TestBed.inject(WorkflowStateService);
  }

  beforeEach(() => {
    localStorage.clear();
    currentUser.set(null);
    crops.set([]);
    activities.set([]);
  });

  it('starts at the beginning for a signed-out visitor', () => {
    const service = create();

    expect(service.completedPhases()).toEqual([]);
    expect(service.progressPercent()).toBe(0);
    expect(service.isFirstTime()).toBeTrue();
    expect(service.showProgress()).toBeFalse(); // nothing to show before signing in
  });

  it('does not turn on first-visit prompts for a farmer who has signed in', () => {
    const service = create();
    currentUser.set({ id: 1 });

    expect(service.isFirstTime()).toBeFalse();
  });

  it('counts registration as done for any signed-in farmer, without marking anything', () => {
    const service = create();
    currentUser.set({ id: 1 });

    expect(service.completedPhases()).toEqual(['registration']);
    expect(service.progressPercent()).toBe(17);
  });

  it("derives location, crop and activity from the farmer's data", () => {
    const service = create();
    currentUser.set({ id: 1, village: 'Hadapsar', state: 'Maharashtra' });
    crops.set([{}]);
    activities.set([{}]);

    expect(service.completedPhases()).toEqual(['registration', 'location', 'crop', 'activity']);
  });

  it('needs both village and state for the location phase', () => {
    const service = create();
    currentUser.set({ id: 1, village: 'Hadapsar' });

    expect(service.isPhaseComplete('location')).toBeFalse();
  });

  it('shows the right progress for a returning farmer on a fresh page load', () => {
    // Nothing was done in this session: everything must come from the data.
    const service = create();
    currentUser.set({ id: 7, village: 'Hadapsar', state: 'Maharashtra' });
    crops.set([{}, {}]);
    activities.set([{}]);
    service.markPhaseComplete('land'); // Home reports lands once it has loaded them

    expect(service.completedPhases().length).toBe(5);
    expect(service.progressPercent()).toBe(83);
    expect(service.currentPhase()).toBe('report');
    expect(service.showProgress()).toBeTrue();
  });

  it('reaches 100% and hides the bar once every phase is done', () => {
    const service = create();
    currentUser.set({ id: 1, village: 'Hadapsar', state: 'Maharashtra' });
    crops.set([{}]);
    activities.set([{}]);
    service.markPhaseComplete('land');
    service.markPhaseComplete('report');

    expect(service.allPhasesComplete()).toBeTrue();
    expect(service.progressPercent()).toBe(100);
    expect(service.showProgress()).toBeFalse();
  });

  it('does not keep progress derived from data once that data is gone', () => {
    const service = create();
    currentUser.set({ id: 1 });
    crops.set([{}]);
    expect(service.isPhaseComplete('crop')).toBeTrue();

    crops.set([]);

    expect(service.isPhaseComplete('crop')).toBeFalse();
  });

  it("keeps one farmer's explicit marks away from the next farmer who signs in", () => {
    const service = create();
    currentUser.set({ id: 1 });
    service.markPhaseComplete('land');
    expect(service.isPhaseComplete('land')).toBeTrue();

    currentUser.set({ id: 2 });

    expect(service.isPhaseComplete('land')).toBeFalse();
  });

  it('ignores marks while signed out', () => {
    const service = create();

    service.markPhaseComplete('land');
    currentUser.set({ id: 1 });

    expect(service.isPhaseComplete('land')).toBeFalse();
  });

  it('remembers a generated report across reloads, per farmer', () => {
    let service = create();
    currentUser.set({ id: 1 });
    service.markPhaseComplete('report');
    expect(service.isPhaseComplete('report')).toBeTrue();

    service = create(); // simulates a page reload: new instance, same localStorage

    expect(service.isPhaseComplete('report')).toBeTrue();
    currentUser.set({ id: 2 });
    expect(service.isPhaseComplete('report')).toBeFalse();
  });
});
