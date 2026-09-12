import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CropActivityComponent } from './crop-activity.component';
import { CropTimelineService } from '../crop-timeline.service';
import { CropEntity } from '../crop-timeline.models';

describe('CropActivityComponent', () => {
  let component: CropActivityComponent;
  let fixture: ComponentFixture<CropActivityComponent>;
  let deleteCropSpy: jasmine.Spy;
  let router: Router;

  const mockCrop: CropEntity = {
    id: 5,
    fieldId: 1,
    name: 'Tomato',
    cropType: 'Tomato',
    area: 2,
    areaUnit: 'acres',
    sowingDate: Date.now(),
    currentStage: 'Land Preparation',
    status: 'Active',
  };

  function setup(cropId: string | null): void {
    TestBed.configureTestingModule({
      imports: [CropActivityComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap(cropId ? { cropId } : {})),
          },
        },
        {
          provide: CropTimelineService,
          useValue: {
            getCropById: (id: number) => (id === mockCrop.id ? mockCrop : undefined),
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
  });

  it('should create the component', () => {
    setup('5');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('resolves the crop and cost from the route cropId param', () => {
    setup('5');
    fixture.detectChanges();

    expect(component.crop()).toEqual(mockCrop);
    expect(component.cropCost()).toBe(1200);
  });

  it('navigates to the nested create route on "Add Activity"', () => {
    setup('5');
    fixture.detectChanges();

    component.onAddActivityClicked();

    expect(router.navigate).toHaveBeenCalledWith(['create'], { relativeTo: component['route'] });
  });

  it('opens the delete-crop confirm dialog and deletes on confirm', () => {
    setup('5');
    fixture.detectChanges();

    component.onDeleteCropClicked();
    expect(component.showDeleteCropConfirm()).toBeTrue();

    component.confirmDeleteCrop();

    expect(deleteCropSpy).toHaveBeenCalledWith(mockCrop.id);
    expect(component.showDeleteCropConfirm()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });

  it('navigates back to the crops dashboard', () => {
    setup('5');
    fixture.detectChanges();

    component.onBackClicked();

    expect(router.navigate).toHaveBeenCalledWith(['/crops']);
  });
});
