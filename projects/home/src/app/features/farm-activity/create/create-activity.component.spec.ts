import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CreateActivityComponent } from './create-activity.component';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkflowStateService } from '../../../core/workflow/workflow-state.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity } from '../../activity/activity.models';

describe('CreateActivityComponent', () => {
  let component: CreateActivityComponent;
  let fixture: ComponentFixture<CreateActivityComponent>;
  let addActivitySpy: jasmine.Spy;
  let updateActivitySpy: jasmine.Spy;
  let createActivityTypeSpy: jasmine.Spy;
  let queryParams: BehaviorSubject<Record<string, string>>;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  const mockNewActivity: Activity = {
    id: 42,
    type: 'Irrigation',
    status: 'Completed',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [CreateActivityComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams, paramMap } },
        {
          provide: ActivityService,
          useValue: {
            activities: signal([]),
            addActivity: addActivitySpy,
            updateActivity: updateActivitySpy,
          },
        },
        { provide: CropTimelineService, useValue: { crops: signal([]), activities: signal([]) } },
        { provide: FarmDrawService, useValue: { loadFarms: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: WorkflowStateService, useValue: { markPhaseComplete: jasmine.createSpy() } },
        {
          provide: ReferenceDataService,
          useValue: {
            listActivityTypes: () => Promise.resolve([]),
            createActivityType: createActivityTypeSpy,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(CreateActivityComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  }

  beforeEach(() => {
    addActivitySpy = jasmine.createSpy('addActivity').and.resolveTo(mockNewActivity);
    updateActivitySpy = jasmine.createSpy('updateActivity');
    createActivityTypeSpy = jasmine
      .createSpy('createActivityType')
      .and.resolveTo({ id: 9, name: 'Mulching' });
    queryParams = new BehaviorSubject<Record<string, string>>({});
    paramMap = new BehaviorSubject(convertToParamMap({}));
  });

  it('should create the component', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('is not crop-scoped when no route cropId param is present', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCropScoped()).toBeFalse();
  });

  it('resolves cropId from the route path param, taking priority over the query param', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    queryParams = new BehaviorSubject<Record<string, string>>({ cropId: '99' });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCropScoped()).toBeTrue();
    expect(component.form.get('cropId')?.value).toBe(5);
  });

  it('navigates to the global activity detail page after create when not crop-scoped', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Irrigation', date: '2026-01-01' });
    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/activities', mockNewActivity.id]);
  });

  it('navigates back relatively after create when crop-scoped', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.form.patchValue({ type: 'Irrigation', date: '2026-01-01' });
    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: component['route'] });
  });

  it('navigates back relatively on cancel when crop-scoped', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '5' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.onCancel();

    expect(router.navigate).toHaveBeenCalledWith(['..'], { relativeTo: component['route'] });
  });

  it('does not navigate and instead emits when in modal mode', async () => {
    setup();
    component.isModal = true;
    fixture.detectChanges();
    await fixture.whenStable();

    spyOn(component.cancelled, 'emit');
    component.onCancel();

    expect(component.cancelled.emit).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('persists a newly typed activity type and patches the form to the canonical name', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onTypeAdded('mulching');

    expect(createActivityTypeSpy).toHaveBeenCalledWith('mulching');
    expect(component.referenceActivityTypes()).toEqual([{ id: 9, name: 'Mulching' }]);
    expect(component.form.get('type')?.value).toBe('Mulching');
  });

  it('shows an error toast when creating a new activity type fails', async () => {
    createActivityTypeSpy.and.rejectWith(new Error('network down'));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await expectAsync(component.onTypeAdded('mulching')).toBeResolved();
    expect(component.referenceActivityTypes()).toEqual([]);
  });
});
