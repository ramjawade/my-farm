import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CropMapperService } from './crop-mapper.service';
import { ReferenceDataService } from '../../core/api/reference-data.service';

describe('CropMapperService', () => {
  let service: CropMapperService;
  let referenceData: jasmine.SpyObj<ReferenceDataService>;

  beforeEach(() => {
    referenceData = jasmine.createSpyObj('ReferenceDataService', [
      'cropNameForId',
      'cropCatalogIdForName',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ReferenceDataService, useValue: referenceData },
      ],
    });
    service = TestBed.inject(CropMapperService);
  });

  it('maps crop_catalog_id straight to cropCatalogId with no lookup', async () => {
    const crop = await service.fromBackend({
      id: 3,
      land_id: 7,
      label: 'North plot soy',
      crop_catalog_id: 7,
      area: '2.5',
      area_unit: 'hectares',
      status: 'Active',
    });

    expect(crop.cropCatalogId).toBe(7);
    expect(crop.name).toBe('North plot soy');
    expect(crop.area).toBe(2.5);
    expect(referenceData.cropNameForId).not.toHaveBeenCalled();
  });

  it('maps cropCatalogId straight to crop_catalog_id with no lookup', async () => {
    const payload = await service.toBackend({ cropCatalogId: 7, name: 'North plot soy' });

    expect(payload['crop_catalog_id']).toBe(7);
    expect(payload['label']).toBe('North plot soy');
    expect(referenceData.cropCatalogIdForName).not.toHaveBeenCalled();
  });

  it('omits crop_catalog_id from a partial update that does not set it', async () => {
    const payload = await service.toBackend({ status: 'Completed' });

    expect(payload['crop_catalog_id']).toBeUndefined();
  });
});
