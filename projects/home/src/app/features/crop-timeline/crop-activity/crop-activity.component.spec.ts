import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { CropActivityComponent } from './crop-activity.component';
import { CropTimelineService } from '../crop-timeline.service';
import { CropActivity, CropEntity } from '../crop-timeline.models';
import { FarmLookupService } from '../../../core/farms/farm-lookup.service';

describe('CropActivityComponent', () => {
  let component: CropActivityComponent;
  let fixture: ComponentFixture<CropActivityComponent>;
  let deleteCropSpy: jasmine.Spy;
  let advanceSpy: jasmine.Spy;
  let router: Router;
  let crop: CropEntity;
  let activities: CropActivity[];

  const el = () => fixture.nativeElement as HTMLElement;
  const day = 86_400_000;
  const activity = (id: number, status: string, daysAgo: number): CropActivity =>
    ({
      id,
      cropId: 5,
      activityTypeId: id,
      status,
      date: Date.now() - daysAgo * day,
      cost: 0,
      notes: '',
      attachments: [],
      metadata: {},
    }) as unknown as CropActivity;

  function setup(cropId: string | null): void {
    TestBed.configureTestingModule({
      imports: [CropActivityComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap(cropId ? { cropId } : {})),
          },
        },
        {
          provide: FarmLookupService,
          useValue: {
            loadForCurrentUser: () => Promise.resolve([{ id: 1, name: 'North Plot', points: [] }]),
          },
        },
        {
          provide: CropTimelineService,
          useValue: {
            getCropById: (id: number) => (id === crop.id ? crop : undefined),
            getActivitiesForCrop: () => activities,
            getNextStage: (stage: string) => (stage === 'Harvest' ? null : 'Sowing'),
            advanceStage: advanceSpy,
            costForCrop: () => 1200,
            deleteCrop: deleteCropSpy,
            reload: () => Promise.resolve(),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(CropActivityComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  }

  beforeEach(() => {
    deleteCropSpy = jasmine.createSpy('deleteCrop');
    advanceSpy = jasmine.createSpy('advanceStage');
    crop = {
      id: 5,
      fieldId: 1,
      name: 'Tomato',
      cropCatalogId: 1,
      area: 2,
      areaUnit: 'acres',
      sowingDate: Date.now() - 30 * day,
      currentStage: 'Land Preparation',
      status: 'Active',
    };
    activities = [];
  });

  async function render(): Promise<void> {
    setup('5');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create the component', async () => {
    await render();
    expect(component).toBeTruthy();
  });

  it('resolves the crop and cost from the route cropId param', async () => {
    await render();
    expect(component.crop()).toEqual(crop);
    expect(component.cropCost()).toBe(1200);
  });

  it('shows the land link, the stage step and omits irrigation and method when unset', async () => {
    await render();
    const line = el().querySelector('header p')?.textContent ?? '';
    expect(line).toContain('North Plot');
    expect(line).toContain('cropStages.sowing');
    expect(line).not.toContain('cropActivity.irrigationLine');
  });

  it('shows irrigation type and farming method when set', async () => {
    crop.irrigationType = 'Drip';
    crop.farmingMethod = 'Organic';
    await render();
    const line = el().querySelector('header p')?.textContent ?? '';
    expect(line).toContain('cropActivity.irrigationLine');
    expect(line).toContain('Organic');
  });

  it('shows the age, activity counts and crop cost tiles', async () => {
    activities = [
      activity(1, 'Completed', 3),
      activity(2, 'Completed', 6),
      activity(3, 'Completed', 9),
      activity(4, 'Scheduled', -2),
      activity(5, 'Draft', -5),
      activity(6, 'Cancelled', 1),
    ];
    await render();
    const text = el().textContent ?? '';
    expect(component.age()).toBe(30);
    expect(component.done().length).toBe(3);
    expect(component.planned().length).toBe(2);
    expect(text).toContain('1,200');
  });

  it('filters the activity list by chip and shows the counts', async () => {
    activities = [activity(1, 'Completed', 3), activity(2, 'Scheduled', -2)];
    await render();
    const chips = () => Array.from(el().querySelectorAll<HTMLButtonElement>('[aria-pressed]'));
    expect(chips().map((c) => c.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'cropActivity.tab.all · 2',
      'cropActivity.tab.upcoming · 1',
      'cropActivity.tab.recent · 1',
    ]);
    chips()[1].click();
    fixture.detectChanges();
    expect(component.visibleActivities().map((a) => a.id)).toEqual([2]);
    chips()[2].click();
    fixture.detectChanges();
    expect(component.visibleActivities().map((a) => a.id)).toEqual([1]);
  });

  it('advances the stage from the Stage card', async () => {
    await render();
    el().querySelector<HTMLButtonElement>('.btn-outline-success')!.click();
    expect(advanceSpy).toHaveBeenCalledWith(5);
  });

  it('hides the advance action at the last stage', async () => {
    crop.currentStage = 'Harvest';
    await render();
    expect(component.canAdvance()).toBeFalse();
    expect(el().querySelector('.btn-outline-success')).toBeNull();
  });

  it('navigates to the nested create route on "Log activity"', async () => {
    await render();
    component.onAddActivityClicked();
    expect(router.navigate).toHaveBeenCalledWith(['create'], { relativeTo: component['route'] });
  });

  it('opens the edit form for the crop', async () => {
    await render();
    component.onEditClicked();
    expect(router.navigate).toHaveBeenCalledWith(['/crops', 5, 'edit']);
  });

  it('opens the delete-crop confirm dialog and deletes on confirm', async () => {
    await render();
    component.onDeleteCropClicked();
    expect(component.showDeleteCropConfirm()).toBeTrue();

    component.confirmDeleteCrop();

    expect(deleteCropSpy).toHaveBeenCalledWith(crop.id);
    expect(component.showDeleteCropConfirm()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });

  it('navigates back to the crops dashboard', async () => {
    await render();
    component.onBackClicked();
    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });
});
