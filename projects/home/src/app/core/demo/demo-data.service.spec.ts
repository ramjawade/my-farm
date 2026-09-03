import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DemoDataService } from './demo-data.service';
import { DEMO_USER_ID, buildDemoDataset } from './demo-dataset';
import { IStorageService } from '../storage/storage.interface';
import { LocalStorageService } from '../storage/local-storage.service';
import { AuthService } from '../auth/auth.service';
import { CropTimelineService } from '../../features/crop-timeline/crop-timeline.service';
import { ActivityService } from '../../features/activity/activity.service';
import { FarmDrawService } from '../../map/farm-draw/farm-draw.service';
import { flushPromises } from '../../testing/flush-promises';

describe('DemoDataService', () => {
  let service: DemoDataService;
  let storage: IStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: IStorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(DemoDataService);
    storage = TestBed.inject(IStorageService);
  });

  it('builds one coherent dataset: every crop sits on a land and every activity on its crop land', () => {
    const data = buildDemoDataset();
    const landIds = new Set(data.farms.map((f) => f.id));
    const cropById = new Map(data.crops.map((c) => [c.id, c]));

    expect(data.farms.length).toBe(2);
    expect(data.crops.every((c) => landIds.has(c.fieldId))).toBeTrue();
    for (const a of data.activities) {
      if (a.cropId) {
        expect(a.fieldId).toBe(cropById.get(a.cropId)!.fieldId);
        expect(a.season).toBe(cropById.get(a.cropId)!.season);
      } else {
        expect(landIds.has(a.fieldId!)).toBeTrue();
      }
    }
    const activityIds = new Set(data.activities.map((a) => a.id));
    expect(data.expenses.every((e) => activityIds.has(e.activityId))).toBeTrue();
    expect(data.farms.every((f) => f.area.hectares > 1)).toBeTrue();
  });

  it('enterDemo seeds once and signs in as the demo farmer', async () => {
    await service.enterDemo();
    await flushPromises();

    const auth = TestBed.inject(AuthService);
    expect(auth.currentUser()?.id).toBe(DEMO_USER_ID);
    expect(service.isDemoUser()).toBeTrue();
    expect((await storage.getCrops(DEMO_USER_ID)).length).toBe(2);
    expect(TestBed.inject(CropTimelineService).crops().length).toBe(2);
    expect(TestBed.inject(FarmDrawService).savedFarms().length).toBe(2);
    expect(TestBed.inject(ActivityService).expenses().length).toBeGreaterThan(5);

    // Existing user edits survive a second entry (seedIfEmpty is a no-op)
    TestBed.inject(CropTimelineService).deleteCrop('demo-crop-wheat');
    await flushPromises();
    await service.enterDemo();
    await flushPromises();
    expect((await storage.getCrops(DEMO_USER_ID)).length).toBe(1);
  });

  it('resetDemoData restores the seeded state', async () => {
    await service.enterDemo();
    await flushPromises();
    const crops = TestBed.inject(CropTimelineService);
    crops.deleteCrop('demo-crop-wheat');
    await flushPromises();
    expect(crops.crops().length).toBe(1);

    await service.resetDemoData();
    await flushPromises();
    expect(crops.crops().length).toBe(2);
    expect(TestBed.inject(ActivityService).activities().length).toBeGreaterThan(10);
  });

  it('exports and restores a backup for the signed-in user', async () => {
    await service.enterDemo();
    await flushPromises();
    const backup = (await service.exportBackup())!;
    expect(backup.crops.length).toBe(2);

    await service.clearMyData();
    await flushPromises();
    expect(TestBed.inject(CropTimelineService).crops().length).toBe(0);

    await service.restoreBackup(backup);
    await flushPromises();
    expect(TestBed.inject(CropTimelineService).crops().length).toBe(2);
  });
});
