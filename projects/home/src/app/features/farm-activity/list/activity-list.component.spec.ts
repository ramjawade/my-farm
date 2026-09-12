import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ActivityListComponent } from './activity-list.component';
import { ActivityListService } from './activity-list.service';
import { ActivityService } from '../../activity/activity.service';
import { CropTimelineService } from '../../crop-timeline/crop-timeline.service';
import { FarmDrawService } from '../../../map/farm-draw/farm-draw.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';
import { Activity } from '../../activity/activity.models';

describe('ActivityListComponent', () => {
  let component: ActivityListComponent;
  let fixture: ComponentFixture<ActivityListComponent>;
  let loadSpy: jasmine.Spy;
  let queryParams: BehaviorSubject<Record<string, string>>;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const mockActivity: Activity = {
    id: 1,
    type: 'Irrigation',
    status: 'Scheduled',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [ActivityListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams, paramMap } },
        { provide: ActivityListService, useValue: { load: loadSpy } },
        {
          provide: ActivityService,
          useValue: {
            activities: signal([]),
            getTotalExpenseForActivity: () => 0,
            deleteActivity: jasmine.createSpy('deleteActivity'),
          },
        },
        { provide: CropTimelineService, useValue: { crops: signal([]) } },
        { provide: FarmDrawService, useValue: { loadFarms: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        {
          provide: ReferenceDataService,
          useValue: { listActivityTypes: () => Promise.resolve([]) },
        },
      ],
    });

    fixture = TestBed.createComponent(ActivityListComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    loadSpy = jasmine.createSpy('load').and.resolveTo([mockActivity]);
    queryParams = new BehaviorSubject<Record<string, string>>({});
    paramMap = new BehaviorSubject(convertToParamMap({}));
  });

  it('should create the list component', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('loads with no filters for the plain landing mode', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ status: 'All', sort: 'latest', cropId: undefined });
    expect(component.activities()).toEqual([mockActivity]);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
  });

  it('loads with Completed/latest for the "recent" landing mode', async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      status: 'Completed',
      sort: 'latest',
    });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({
      status: 'Completed',
      sort: 'latest',
      cropId: undefined,
    });
  });

  it('loads with Upcoming/oldest for the "upcoming" landing mode', async () => {
    queryParams = new BehaviorSubject<Record<string, string>>({
      status: 'Upcoming',
      sort: 'oldest',
    });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({
      status: 'Upcoming',
      sort: 'oldest',
      cropId: undefined,
    });
  });

  it('scopes the load to a crop when the route supplies a cropId param', async () => {
    paramMap = new BehaviorSubject(convertToParamMap({ cropId: '7' }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ status: 'All', sort: 'latest', cropId: 7 });
    expect(component.isCropScoped()).toBeTrue();
  });

  it('shows an error state with retry when the load fails', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    loadSpy.and.rejectWith(new Error('network down'));
    await component.reload();

    expect(component.error()).toBe('Could not load activities. Please try again.');

    loadSpy.and.resolveTo([mockActivity]);
    await component.reload();
    expect(component.error()).toBeNull();
  });

  it('optimistically removes an activity from the local list on delete', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component.selectedActivityId.set(mockActivity.id);
    component.confirmDeleteActivity();

    expect(component.activities().length).toBe(0);
  });

  it('re-fetches when the manual crop filter changes', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    loadSpy.calls.reset();

    component.setCrop('3');
    await fixture.whenStable();

    expect(loadSpy).toHaveBeenCalledWith({ status: 'All', sort: 'latest', cropId: 3 });
  });
});
