import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FarmsApiService } from './farms-api.service';
import { HttpService } from '../http/http.service';

describe('FarmsApiService', () => {
  let service: FarmsApiService;
  let http: jasmine.SpyObj<HttpService>;

  beforeEach(() => {
    http = jasmine.createSpyObj('HttpService', ['get', 'patch', 'post']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: HttpService, useValue: http }],
    });
    service = TestBed.inject(FarmsApiService);
  });

  it('picks the lowest-id farm regardless of list order', async () => {
    http.get.and.resolveTo({ items: [{ id: 9 }, { id: 2 }, { id: 5 }] });
    expect((await service.getDefaultFarm())?.id).toBe(2);
  });

  it('creates the farm on first update when none exists', async () => {
    http.get.and.resolveTo({ items: [] });
    http.post.and.resolveTo({ id: 7 });
    http.patch.and.resolveTo({ id: 7 });

    await service.updateDefaultFarm({ name: 'Green Acres' });

    expect(http.post).toHaveBeenCalledWith('/farms', { name: 'My Farm' });
    expect(http.patch).toHaveBeenCalledWith('/farms/7', { name: 'Green Acres' });
  });

  it('updates the existing default farm without creating one', async () => {
    http.get.and.resolveTo({ items: [{ id: 4 }] });
    http.patch.and.resolveTo({ id: 4 });

    await service.updateDefaultFarm({ setup_completed: true });

    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).toHaveBeenCalledWith('/farms/4', { setup_completed: true });
  });
});
