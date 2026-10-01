import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FarmerProfileApiService, roleLabel } from './farmer-profile-api.service';
import { FarmsApiService } from './farms-api.service';
import { ReferenceDataService } from './reference-data.service';
import { HttpService } from '../http/http.service';

describe('FarmerProfileApiService', () => {
  let service: FarmerProfileApiService;
  let http: jasmine.SpyObj<HttpService>;
  let farms: jasmine.SpyObj<FarmsApiService>;

  beforeEach(() => {
    http = jasmine.createSpyObj('HttpService', ['get', 'patch', 'post']);
    http.patch.and.resolveTo({});
    farms = jasmine.createSpyObj('FarmsApiService', ['getDefaultFarm', 'updateDefaultFarm']);
    farms.updateDefaultFarm.and.resolveTo({} as never);
    const names: Record<string, number> = { Wheat: 1, Rice: 2 };
    const ids = new Map(Object.entries(names).map(([n, id]) => [id, n]));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpService, useValue: http },
        { provide: FarmsApiService, useValue: farms },
        {
          provide: ReferenceDataService,
          useValue: {
            ready: () => Promise.resolve(),
            cropName: (id: number) => ids.get(id) ?? '',
            cropCatalogIdForName: (n: string) => Promise.resolve(names[n]),
          },
        },
      ],
    });
    service = TestBed.inject(FarmerProfileApiService);
  });

  it('sends account fields to /me with the backend role value', async () => {
    await service.saveProfile({ fullName: 'Asha', userRole: 'Farm Owner' });

    expect(http.patch).toHaveBeenCalledWith('/me', { full_name: 'Asha', user_role: 'farm_owner' });
    expect(farms.updateDefaultFarm).not.toHaveBeenCalled();
  });

  it('sends farm fields and crop ids to the default farm', async () => {
    await service.saveProfile({
      farmName: 'Green Acres',
      farmArea: 5.5,
      primaryCrops: ['Wheat', 'Rice'],
      location: { lat: 18.5, lng: 73.5 },
      farmSetupCompleted: true,
    });

    expect(http.patch).not.toHaveBeenCalled();
    expect(farms.updateDefaultFarm).toHaveBeenCalledWith({
      name: 'Green Acres',
      area: '5.5',
      lat: 18.5,
      lng: 73.5,
      setup_completed: true,
      crop_catalog_ids: [1, 2],
    });
  });

  it('clears optional farm fields and falls back to the default name', async () => {
    await service.saveProfile({ farmName: '', waterSource: '', location: null, farmArea: 0 });

    expect(farms.updateDefaultFarm).toHaveBeenCalledWith({
      name: 'My Farm',
      water_source: null,
      lat: null,
      lng: null,
      area: null,
    });
  });

  it('rejects when a write fails', async () => {
    farms.updateDefaultFarm.and.rejectWith(new Error('boom'));
    await expectAsync(service.saveProfile({ farmName: 'X' })).toBeRejected();
  });

  it('maps the default farm back to profile fields', async () => {
    farms.getDefaultFarm.and.resolveTo({
      id: 3,
      name: 'Green Acres',
      area: '5.50',
      area_unit: 'acres',
      crop_catalog_ids: [2, 1],
      water_source: 'Canal',
      lat: '18.500000',
      lng: '73.500000',
      location_type: 'map',
      setup_completed: true,
    } as never);

    const fields = await service.getFarmFields();

    expect(fields.farmName).toBe('Green Acres');
    expect(fields.farmArea).toBe(5.5);
    expect(fields.farmAreaUnit).toBe('acres');
    expect(fields.primaryCrops).toEqual(['Rice', 'Wheat']);
    expect(fields.location).toEqual({ lat: 18.5, lng: 73.5 });
    expect(fields.locationType).toBe('map');
    expect(fields.farmSetupCompleted).toBeTrue();
  });

  it('shows the placeholder farm name as unset and handles no farm', async () => {
    farms.getDefaultFarm.and.resolveTo({ id: 1, name: 'My Farm' } as never);
    expect((await service.getFarmFields()).farmName).toBe('');
    farms.getDefaultFarm.and.resolveTo(null);
    expect(await service.getFarmFields()).toEqual({});
  });

  it('labels backend roles', () => {
    expect(roleLabel('farm_worker')).toBe('Farm Worker');
    expect(roleLabel(undefined)).toBe('Farmer');
  });
});
