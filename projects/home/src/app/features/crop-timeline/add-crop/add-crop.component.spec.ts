import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { AddCropComponent } from './add-crop.component';
import { AddCropService } from './add-crop.service';
import { CropTimelineService } from '../crop-timeline.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LandsApiService } from '../../../core/api/lands-api.service';
import { FakeLandsApiService } from '../../../testing/fake-lands-api.service';
import { ReferenceDataService } from '../../../core/api/reference-data.service';

describe('AddCropComponent', () => {
  let component: AddCropComponent;
  let fixture: ComponentFixture<AddCropComponent>;
  const fb = new FormBuilder();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCropComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        AddCropService,
        AuthService,
        { provide: LandsApiService, useClass: FakeLandsApiService },
        {
          provide: ReferenceDataService,
          useValue: { cropCatalogIdForName: () => Promise.resolve(42) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddCropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the add-crop component', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit if form is invalid', () => {
    const addCropService = TestBed.inject(AddCropService);
    spyOn(addCropService, 'createCrop');

    // Invalid initially (name and fieldId empty)
    component.onSubmit();
    expect(addCropService.createCrop).not.toHaveBeenCalled();
  });

  it('should call createCrop with CROP_STAGES[0] as currentStage on submit', async () => {
    const addCropService = TestBed.inject(AddCropService);
    spyOn(addCropService, 'createCrop').and.resolveTo({ id: 1, name: 'Test Crop' } as any);
    const navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    // Fill form to make it valid
    component.cropForm.patchValue({
      name: 'My Soy Crop',
      fieldId: 7,
      area: '10',
      areaUnit: 'hectares',
      sowingDate: '2026-09-12',
    });
    fixture.detectChanges();

    await component.onSubmit();
    expect(addCropService.createCrop).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'My Soy Crop',
        cropCatalogId: 42,
        currentStage: 'Land Preparation',
      }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/crops']);
  });
});

describe('AddCropComponent land preselection and edit', () => {
  const land = (id: number, name: string) => ({
    id,
    name,
    points: [],
    area: { squareMeters: 4047, hectares: 0.4, acres: 1 },
    geoJson: null,
    createdAt: 0,
  });

  const existing = {
    id: 3,
    fieldId: 2,
    name: 'Onion',
    cropCatalogId: 9,
    area: 1.5,
    areaUnit: 'acres',
    season: 'Rabi',
    sowingDate: Date.parse('2026-09-01'),
    currentStage: 'Sowing',
    status: 'Active',
    irrigationType: 'Drip',
    farmingMethod: 'Organic',
  };

  let updateCropSpy: jasmine.Spy;
  let createCropSpy: jasmine.Spy;

  async function open(
    query: Record<string, string>,
    params: Record<string, string> = {},
    farms = [land(1, 'North'), land(2, 'South')],
  ): Promise<AddCropComponent> {
    updateCropSpy = jasmine.createSpy('updateCrop');
    createCropSpy = jasmine.createSpy('createCrop').and.resolveTo({ id: 1, name: 'Soy' });
    await TestBed.configureTestingModule({
      imports: [AddCropComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        {
          provide: AddCropService,
          useValue: {
            getCrops: () => Promise.resolve(params['cropId'] ? [existing] : []),
            createCrop: createCropSpy,
          },
        },
        { provide: CropTimelineService, useValue: { updateCrop: updateCropSpy } },
        AuthService,
        { provide: LandsApiService, useClass: FakeLandsApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(query),
              paramMap: convertToParamMap(params),
            },
          },
        },
        {
          provide: ReferenceDataService,
          useValue: { cropCatalogIdForName: () => Promise.resolve(42) },
        },
      ],
    }).compileComponents();
    const lands = TestBed.inject(LandsApiService) as unknown as FakeLandsApiService;
    lands.farms = farms;
    TestBed.inject(AuthService).login({ id: 7 } as never);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(AddCropComponent);
    await fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  it('preselects the land named in ?landId=', async () => {
    const component = await open({ landId: '2' });
    expect(component.cropForm.controls.fieldId.value).toBe(2);
  });

  it('leaves the land empty when there are several and none is named', async () => {
    const component = await open({});
    expect(component.cropForm.controls.fieldId.value).toBeNull();
  });

  it("ignores a landId that is not one of the farmer's lands", async () => {
    const component = await open({ landId: '99' });
    expect(component.cropForm.controls.fieldId.value).toBeNull();
  });

  it('creates a crop with the optional irrigation and farming method', async () => {
    const component = await open({ landId: '1' });
    component.cropForm.patchValue({
      name: 'Soy',
      area: '2',
      sowingDate: '2026-09-12',
      irrigationType: 'Drip',
      farmingMethod: 'Organic',
    });
    await component.onSubmit();
    expect(createCropSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ irrigationType: 'Drip', farmingMethod: 'Organic' }),
    );
  });

  it('creates a crop with both optional fields empty when left as Not set', async () => {
    const component = await open({ landId: '1' });
    component.cropForm.patchValue({ name: 'Soy', area: '2', sowingDate: '2026-09-12' });
    await component.onSubmit();
    const sent = createCropSpy.calls.mostRecent().args[0];
    expect(sent.irrigationType).toBeUndefined();
    expect(sent.farmingMethod).toBeUndefined();
  });

  it('requires the sowing date', async () => {
    const component = await open({ landId: '1' });
    component.cropForm.patchValue({ name: 'Soy', area: '2' });
    expect(component.cropForm.controls.sowingDate.invalid).toBeTrue();
    await component.onSubmit();
    expect(createCropSpy).not.toHaveBeenCalled();
  });

  it('reports that there are no saved lands and blocks saving', async () => {
    const component = await open({}, {}, []);
    expect(component.noLands()).toBeTrue();
  });

  describe('editing', () => {
    it('fills the form from the crop and keeps the land read-only', async () => {
      const component = await open({}, { cropId: '3' });
      expect(component.isEdit).toBeTrue();
      const value = component.cropForm.getRawValue();
      expect(value.name).toBe('Onion');
      expect(value.fieldId).toBe(2);
      expect(value.area).toBe('1.5');
      expect(value.irrigationType).toBe('Drip');
      expect(value.farmingMethod).toBe('Organic');
      expect(value.sowingDate).toBe('2026-09-01');
      expect(component.cropForm.controls.fieldId.disabled).toBeTrue();
    });

    it('saves changes through updateCrop, including clearing an optional field', async () => {
      const component = await open({}, { cropId: '3' });
      component.cropForm.patchValue({ irrigationType: '', farmingMethod: 'Natural Farming' });
      await component.onSubmit();
      expect(createCropSpy).not.toHaveBeenCalled();
      expect(updateCropSpy).toHaveBeenCalledWith(
        3,
        jasmine.objectContaining({ irrigationType: '', farmingMethod: 'Natural Farming' }),
      );
    });
  });
});
