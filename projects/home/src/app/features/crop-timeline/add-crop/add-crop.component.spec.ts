import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { AddCropComponent } from './add-crop.component';
import { AddCropService } from './add-crop.service';
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

describe('AddCropComponent land preselection', () => {
  const land = (id: number, name: string) => ({
    id,
    name,
    points: [],
    area: { squareMeters: 4047, hectares: 0.4, acres: 1 },
    geoJson: null,
    createdAt: 0,
  });

  async function open(query: Record<string, string>): Promise<AddCropComponent> {
    await TestBed.configureTestingModule({
      imports: [AddCropComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideTranslateService(),
        { provide: AddCropService, useValue: { getCrops: () => Promise.resolve([]) } },
        AuthService,
        { provide: LandsApiService, useClass: FakeLandsApiService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        {
          provide: ReferenceDataService,
          useValue: { cropCatalogIdForName: () => Promise.resolve(42) },
        },
      ],
    }).compileComponents();
    const lands = TestBed.inject(LandsApiService) as unknown as FakeLandsApiService;
    lands.farms = [land(1, 'North'), land(2, 'South')];
    TestBed.inject(AuthService).login({ id: 7 } as never);
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
});
