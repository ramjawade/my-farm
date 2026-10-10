import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CropMapperService } from './crop-mapper.service';

describe('CropMapperService', () => {
  let service: CropMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(CropMapperService);
  });

  it('maps crop_catalog_id straight to cropCatalogId', () => {
    const crop = service.fromBackend({
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
  });

  it('maps cropCatalogId straight to crop_catalog_id', () => {
    const payload = service.toBackend({ cropCatalogId: 7, name: 'North plot soy' });

    expect(payload['crop_catalog_id']).toBe(7);
    expect(payload['label']).toBe('North plot soy');
  });

  it('omits crop_catalog_id from a partial update that does not set it', () => {
    const payload = service.toBackend({ status: 'Completed' });

    expect(payload['crop_catalog_id']).toBeUndefined();
  });

  it('reads irrigation type and farming method, and leaves them undefined when null', () => {
    const set = service.fromBackend({ id: 1, irrigation_type: 'Drip', farming_method: 'Organic' });
    expect(set.irrigationType).toBe('Drip');
    expect(set.farmingMethod).toBe('Organic');
    const blank = service.fromBackend({ id: 2, irrigation_type: null, farming_method: null });
    expect(blank.irrigationType).toBeUndefined();
    expect(blank.farmingMethod).toBeUndefined();
  });

  it('writes irrigation type and farming method, null when cleared', () => {
    const set = service.toBackend({ irrigationType: 'Drip', farmingMethod: 'Organic' });
    expect(set['irrigation_type']).toBe('Drip');
    expect(set['farming_method']).toBe('Organic');
    const cleared = service.toBackend({ irrigationType: '', farmingMethod: '' });
    expect(cleared['irrigation_type']).toBeNull();
    expect(cleared['farming_method']).toBeNull();
  });

  it('leaves irrigation and method out of a partial update that does not set them', () => {
    const payload = service.toBackend({ currentStage: 'Flowering' });
    expect(payload['irrigation_type']).toBeUndefined();
    expect(payload['farming_method']).toBeUndefined();
  });
});
