import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { CropTimelineDetailComponent } from './crop-timeline-detail.component';
import { CropActivity, CropEntity } from '../crop-timeline.models';
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

  const mockCrop: Omit<CropEntity, 'id'> = {
    name: 'Soybeans',
    cropType: 'Soybeans',
    fieldId: 'Field A',
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
    TestBed.inject(AuthService).login({ id: 'f-detail-test' } as any);
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

  it('should resolve the crop from the route id', () => {
    const crop = timelineService.addCrop(mockCrop);

    paramMap$.next(convertToParamMap({ id: crop.id }));
    fixture.detectChanges();

    expect(component.crop()).toEqual(jasmine.objectContaining({ id: crop.id, name: 'Soybeans' }));
  });

  it('should not update stage immediately when onUpdateStageClicked is called, but should set parentActivityIdForModal', () => {
    const crop = timelineService.addCrop(mockCrop);
    paramMap$.next(convertToParamMap({ id: crop.id }));
    fixture.detectChanges();

    const initialStage = crop.currentStage;
    expect(initialStage).toBe('Flowering');

    // Click stage node 'Maturity' (index 6, which is Planned)
    component.onUpdateStageClicked('Maturity');
    fixture.detectChanges();

    // Verify crop stage is NOT advanced immediately
    const currentCrop = timelineService.crops().find((c) => c.id === crop.id)!;
    expect(currentCrop.currentStage).toBe('Flowering');

    // Verify parentActivityIdForModal is set to the pre-created Maturity stage activity
    const maturityAct = timelineService.findMainActivityForStage(crop.id, 'Maturity')!;
    expect(maturityAct).toBeTruthy();
    expect(maturityAct.status).toBe('Scheduled');
    expect(component.parentActivityIdForModal()).toBe(maturityAct.id);

    // Simulate submitting a subactivity under this parent activity
    timelineService.addActivity({
      cropId: crop.id,
      type: 'Labour Activity',
      date: Date.now(),
      status: 'Completed',
      cost: 0,
      notes: 'Subactivity notes',
      parentActivityId: maturityAct.id,
    });

    // Now verify parent activity is marked Completed and crop stage is advanced
    const updatedMaturityAct = timelineService.activities().find((a) => a.id === maturityAct.id)!;
    expect(updatedMaturityAct.status).toBe('Completed');

    const updatedCrop = timelineService.crops().find((c) => c.id === crop.id)!;
    expect(updatedCrop.currentStage).toBe('Maturity');
  });

  it('should set modal state when onEditActivityClicked is called', () => {
    const mockActivity: CropActivity = {
      id: 'act-edit-1',
      cropId: 'c1',
      type: 'Irrigation',
      date: Date.now(),
      status: 'Scheduled',
      cost: 0,
      notes: 'Test irrigation notes',
      attachments: [],
      metadata: {},
      parentActivityId: 'a-parent-id',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    component.onEditActivityClicked(mockActivity);

    expect(component.editingActivityIdForModal()).toBe('act-edit-1');
    expect(component.parentActivityIdForModal()).toBe('a-parent-id');
    expect(component.showActivityModal()).toBeTrue();
  });

  it('should delete the crop and navigate to /crops on confirmDeleteCrop', () => {
    const crop = timelineService.addCrop(mockCrop);
    paramMap$.next(convertToParamMap({ id: crop.id }));
    fixture.detectChanges();

    component.onDeleteCropClicked();
    expect(component.showDeleteCropConfirm()).toBeTrue();

    component.confirmDeleteCrop();

    expect(timelineService.crops().find((c) => c.id === crop.id)).toBeUndefined();
    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });
});
