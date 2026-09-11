import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { CropTimelineComponent } from './crop-timeline.component';
import { CropTimelineService } from './crop-timeline.service';
import { CROP_STAGES, CropEntity } from './crop-timeline.models';
import { Activity } from '../activity/activity.models';
import { AuthService } from '../../core/auth/auth.service';
import { IStorageService } from '../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../testing/in-memory-storage.service';
import { flushPromises } from '../../testing/flush-promises';

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Mirrors the 8-per-crop stage placeholder shape `CropTimelineService.addCrop`
 * produces, so the fixture looks like a crop the app itself created.
 */
function buildStageActivities(
  cropId: string,
  currentStageIdx: number,
  sowingDate?: number,
): Activity[] {
  return CROP_STAGES.map((stage, idx) => ({
    id: `${cropId}-stage-${idx}`,
    cropId,
    type: stage === 'Sowing' ? 'Sowing' : stage === 'Harvest' ? 'Harvest' : 'Field Inspection',
    date: sowingDate !== undefined ? sowingDate + idx * ONE_DAY : undefined,
    status: idx <= currentStageIdx ? 'Completed' : 'Scheduled',
    notes: `Growth stage advanced to: ${stage}.`,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

describe('CropTimelineComponent', () => {
  let component: CropTimelineComponent;
  let fixture: ComponentFixture<CropTimelineComponent>;
  let storage: InMemoryStorageService;
  let timelineService: CropTimelineService;
  let router: Router;

  // Fruiting / Pod Formation is index 5 of CROP_STAGES: 6 stages completed
  // (Land Preparation..Fruiting/Pod Formation), 2 scheduled (Maturity, Harvest).
  const soySownDaysAgo = 65;
  const soySowingDate = Date.now() - soySownDaysAgo * ONE_DAY;
  const soyCrop: CropEntity = {
    id: 'crop-soy',
    fieldId: 'Field A',
    name: 'Soybean Plot',
    cropType: 'Soybeans',
    area: 2,
    areaUnit: 'hectares',
    sowingDate: soySowingDate,
    currentStage: 'Fruiting / Pod Formation',
    status: 'Active',
  };

  const wheatCrop: CropEntity = {
    id: 'crop-wheat',
    fieldId: 'Field B',
    name: 'Wheat Field',
    cropType: 'Wheat',
    area: 1,
    areaUnit: 'acres',
    currentStage: 'Land Preparation',
    status: 'Active',
  };

  // A completed activity outside the stage placeholders — feeds the history list.
  const irrigationHistory: Activity = {
    id: 'act-soy-irrigation',
    cropId: soyCrop.id,
    type: 'Irrigation',
    date: Date.now() - 3 * ONE_DAY,
    status: 'Completed',
    notes: 'Drip irrigation',
    metadata: { irrigationMethod: 'Drip', waterQuantity: 1000, duration: 30 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // A scheduled activity outside the stage placeholders — feeds the upcoming list.
  const weedingUpcoming: Activity = {
    id: 'act-soy-weeding',
    cropId: soyCrop.id,
    type: 'Weeding',
    date: Date.now() + 5 * ONE_DAY,
    status: 'Scheduled',
    notes: 'Manual weeding',
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // A sub-activity logged under the Fruiting/Pod Formation main stage activity —
  // must be excluded from cropActivities()/upcomingActivities().
  const subActivity: Activity = {
    id: 'act-soy-sub-labour',
    cropId: soyCrop.id,
    parentActivityId: 'crop-soy-stage-5',
    type: 'Labour Activity',
    date: Date.now() - 2 * ONE_DAY,
    status: 'Completed',
    notes: 'Helper logged under the stage activity',
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CropTimelineComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        CropTimelineService,
        AuthService,
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();

    storage = TestBed.inject(IStorageService) as InMemoryStorageService;

    // Seed the double's arrays before login triggers the load — this is how
    // CropTimelineService/ActivityService populate their signals.
    storage.crops = [soyCrop, wheatCrop];
    storage.activities = [
      ...buildStageActivities(soyCrop.id, 5, soySowingDate),
      ...buildStageActivities(wheatCrop.id, 0),
      irrigationHistory,
      weedingUpcoming,
      subActivity,
    ];

    fixture = TestBed.createComponent(CropTimelineComponent);
    component = fixture.componentInstance;
    timelineService = TestBed.inject(CropTimelineService);
    router = TestBed.inject(Router);

    TestBed.inject(AuthService).login({ id: 'f-crop-timeline-test' } as any);
    TestBed.flushEffects();
    await flushPromises();
    fixture.detectChanges();
  });

  it('should create the component with crops loaded', () => {
    expect(component).toBeTruthy();
    expect(timelineService.crops().length).toBe(2);
  });

  it('calculates days after sowing', () => {
    expect(component.getDaysAfterSowing(soySowingDate)).toBe(soySownDaysAgo);
    expect(component.getDaysAfterSowing(undefined)).toBe(0);
  });

  describe('search-term filtering', () => {
    it('filters the crop list by name', () => {
      component.searchTerm.set('soy');
      expect(component.filteredCrops().map((c) => c.id)).toEqual([soyCrop.id]);
    });

    it('filters the crop list by field id', () => {
      component.searchTerm.set('field b');
      expect(component.filteredCrops().map((c) => c.id)).toEqual([wheatCrop.id]);
    });

    it('returns every crop when the search term is empty', () => {
      component.searchTerm.set('');
      expect(component.filteredCrops().length).toBe(2);
    });
  });

  describe('selecting a crop', () => {
    it('switches to the timeline view and populates history + upcoming lists', () => {
      const crop = timelineService.crops().find((c) => c.id === soyCrop.id)!;
      component.selectCrop(crop);
      fixture.detectChanges();

      expect(component.currentView()).toBe('timeline');
      expect(component.selectedCrop()?.id).toBe(soyCrop.id);

      const historyIds = component.cropActivities().map((a) => a.id);
      expect(historyIds).toContain(irrigationHistory.id);
      expect(historyIds).toContain('crop-soy-stage-5'); // completed Fruiting/Pod Formation

      const upcomingIds = component.upcomingActivities().map((a) => a.id);
      expect(upcomingIds).toContain(weedingUpcoming.id);
      expect(upcomingIds).toContain('crop-soy-stage-6'); // scheduled Maturity
    });
  });

  it('excludes sub-activities (parentActivityId set) from the computed activity lists', () => {
    const crop = timelineService.crops().find((c) => c.id === soyCrop.id)!;
    component.selectCrop(crop);
    fixture.detectChanges();

    const allIds = [
      ...component.cropActivities().map((a) => a.id),
      ...component.upcomingActivities().map((a) => a.id),
    ];
    expect(allIds).not.toContain(subActivity.id);
  });

  it('advancing a stage records a Field Inspection diary entry', () => {
    const crop = timelineService.crops().find((c) => c.id === soyCrop.id)!;
    component.selectCrop(crop);
    fixture.detectChanges();

    component.updateStage('Maturity');
    fixture.detectChanges();

    const maturityAct = timelineService.findMainActivityForStage(soyCrop.id, 'Maturity')!;
    expect(maturityAct).toBeTruthy();
    expect(maturityAct.type).toBe('Field Inspection');
    expect(maturityAct.status).toBe('Completed');
    expect(maturityAct.notes).toContain('Growth stage advanced to: Maturity');

    const updatedCrop = timelineService.crops().find((c) => c.id === soyCrop.id)!;
    expect(updatedCrop.currentStage).toBe('Maturity');
  });

  describe('activity forms', () => {
    beforeEach(() => {
      const crop = timelineService.crops().find((c) => c.id === soyCrop.id)!;
      component.selectCrop(crop);
      fixture.detectChanges();
    });

    it('adds a new activity through the form', () => {
      component.openAddActivityModal();
      component.activityForm.patchValue({
        type: 'Irrigation',
        date: new Date().toISOString().substring(0, 10),
        status: 'Completed',
        cost: 250,
        notes: 'Second irrigation round',
      });

      component.onSubmitActivity();

      const created = timelineService
        .getActivitiesForCrop(soyCrop.id)
        .find((a) => a.notes === 'Second irrigation round');
      expect(created).toBeTruthy();
      expect(created!.cost).toBe(250);
      expect(component.showActivityModal()).toBeFalse();
    });

    it('edits an existing activity through the form', () => {
      component.openEditActivityModal(
        component.cropActivities().find((a) => a.id === irrigationHistory.id)!,
      );
      component.activityForm.patchValue({ notes: 'Updated irrigation notes', cost: 999 });

      component.onSubmitActivity();

      const updated = timelineService.getCropActivity(irrigationHistory.id)!;
      expect(updated.notes).toBe('Updated irrigation notes');
      expect(updated.cost).toBe(999);
    });

    it('deletes an activity after confirmation', () => {
      component.onDeleteActivity(irrigationHistory.id);
      expect(component.showDeleteConfirm()).toBeTrue();

      component.confirmDeleteActivity();

      expect(timelineService.getCropActivity(irrigationHistory.id)).toBeUndefined();
    });
  });

  describe('deleting a crop', () => {
    it('removes the crop and navigates to /crops after confirmation', () => {
      spyOn(router, 'navigate');

      component.onDeleteCrop(soyCrop.id);
      expect(component.showDeleteCropConfirm()).toBeTrue();

      component.confirmDeleteCrop();

      expect(timelineService.crops().find((c) => c.id === soyCrop.id)).toBeUndefined();
      expect(router.navigate).toHaveBeenCalledWith(['/crops']);
    });
  });
});
