import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CropTimelineDetailComponent } from './crop-timeline-detail.component';
import { CropActivity, NewCrop } from '../crop-timeline.models';
import { CropTimelineService } from '../crop-timeline.service';
import { AuthService } from '../../../core/auth/auth.service';
import { IStorageService } from '../../../core/storage/storage.interface';
import { InMemoryStorageService } from '../../../testing/in-memory-storage.service';

describe('CropTimelineDetailComponent', () => {
  let component: CropTimelineDetailComponent;
  let fixture: ComponentFixture<CropTimelineDetailComponent>;
  let timelineService: CropTimelineService;
  let router: Router;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const mockCrop: NewCrop = {
    name: 'Soybeans',
    cropType: 'Soybeans',
    fieldId: 7,
    area: 10,
    areaUnit: 'hectares',
    sowingDate: Date.now(),
    currentStage: 'Flowering',
    status: 'Active',
  };

  beforeEach(async () => {
    const spyRouter = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    spyRouter.createUrlTree.and.returnValue({});
    spyRouter.serializeUrl.and.returnValue('');
    spyRouter.events = of();

    paramMap$ = new BehaviorSubject(convertToParamMap({}));
    const mockActivatedRoute = { paramMap: paramMap$ };

    await TestBed.configureTestingModule({
      imports: [CropTimelineDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        { provide: Router, useValue: spyRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        CropTimelineService,
        AuthService,
        { provide: IStorageService, useClass: InMemoryStorageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    timelineService = TestBed.inject(CropTimelineService);
    TestBed.inject(AuthService).login({ id: 1 } as any);
    TestBed.flushEffects();

    fixture = TestBed.createComponent(CropTimelineDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the detail component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate days after sowing correctly', () => {
    const today = Date.now();
    expect(component.getDaysAfterSowing(today)).toBe(0);
  });

  it('should get stage index', () => {
    expect(component.getStageIndex('Flowering')).toBe(4);
  });

  it('should resolve the crop from the numeric route id', async () => {
    const crop = await timelineService.addCrop(mockCrop);

    paramMap$.next(convertToParamMap({ id: String(crop.id) }));
    fixture.detectChanges();

    expect(component.crop()).toEqual(jasmine.objectContaining({ id: crop.id, name: 'Soybeans' }));
  });

  it('should resolve nothing for a malformed route id', () => {
    paramMap$.next(convertToParamMap({ id: 'not-a-number' }));
    fixture.detectChanges();

    expect(component.crop()).toBeNull();
  });

  it('should link every stage activity to the crop server id', async () => {
    const crop = await timelineService.addCrop(mockCrop);

    const stageActs = timelineService.getActivitiesForCrop(crop.id);
    expect(stageActs.length).toBe(8);
    expect(stageActs.every((a) => a.cropId === crop.id && a.fieldId === 7)).toBeTrue();
  });

  it('does not advance crop stage when a stage sub-activity is completed (unlinked, #167)', async () => {
    const crop = await timelineService.addCrop(mockCrop);
    paramMap$.next(convertToParamMap({ id: String(crop.id) }));
    fixture.detectChanges();

    expect(crop.currentStage).toBe('Flowering');

    const maturityAct = timelineService.findMainActivityForStage(crop.id, 'Maturity')!;
    expect(maturityAct).toBeTruthy();
    expect(maturityAct.status).toBe('Scheduled');

    // Simulate submitting a subactivity under this parent activity
    await timelineService.addActivity({
      cropId: crop.id,
      type: 'Labour Activity',
      date: Date.now(),
      status: 'Completed',
      cost: 0,
      notes: 'Subactivity notes',
      parentActivityId: maturityAct.id,
    });

    // Parent activity and crop stage are both unaffected — sync is disconnected
    const updatedMaturityAct = timelineService.activities().find((a) => a.id === maturityAct.id)!;
    expect(updatedMaturityAct.status).toBe('Scheduled');

    const updatedCrop = timelineService.crops().find((c) => c.id === crop.id)!;
    expect(updatedCrop.currentStage).toBe('Flowering');
  });

  it('does not advance crop stage when completeActivity is called directly (unlinked, #167)', async () => {
    const crop = await timelineService.addCrop(mockCrop);
    const maturityAct = timelineService.findMainActivityForStage(crop.id, 'Maturity')!;

    timelineService.completeActivity(maturityAct.id);

    const updatedCrop = timelineService.crops().find((c) => c.id === crop.id)!;
    expect(updatedCrop.currentStage).toBe('Flowering');
  });

  it('should set modal state when onEditActivityClicked is called', () => {
    const mockActivity: CropActivity = {
      id: 101,
      cropId: 1,
      type: 'Irrigation',
      date: Date.now(),
      status: 'Scheduled',
      cost: 0,
      notes: 'Test irrigation notes',
      attachments: [],
      metadata: {},
      parentActivityId: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    component.onEditActivityClicked(mockActivity);

    expect(component.editingActivityIdForModal()).toBe(101);
    expect(component.parentActivityIdForModal()).toBe(100);
    expect(component.showActivityModal()).toBeTrue();
  });

  it('should delete the crop and navigate to /crops on confirmDeleteCrop', async () => {
    const crop = await timelineService.addCrop(mockCrop);
    paramMap$.next(convertToParamMap({ id: String(crop.id) }));
    fixture.detectChanges();

    component.onDeleteCropClicked();
    expect(component.showDeleteCropConfirm()).toBeTrue();

    component.confirmDeleteCrop();

    expect(timelineService.crops().find((c) => c.id === crop.id)).toBeUndefined();
    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });
});
