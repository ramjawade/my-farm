import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { MapComponent } from './map';
import { SavedFarm } from './models/map.models';
import { LandsApiService } from '../core/api/lands-api.service';
import { AuthService } from '../core/auth/auth.service';
import { FakeLandsApiService } from '../testing/fake-lands-api.service';
import { CropTimelineService } from '../features/crop-timeline/crop-timeline.service';
import { CropEntity } from '../features/crop-timeline/crop-timeline.models';
import { LandSavedService } from './farm-draw/land-saved.service';
import { FarmDrawService } from './farm-draw/farm-draw.service';

const land = (id: number, name: string, acres: number): SavedFarm => ({
  id,
  name,
  points: [],
  area: { squareMeters: acres * 4046.86, hectares: acres * 0.4047, acres },
  geoJson: null,
  createdAt: 0,
});

describe('MapComponent (Lands page)', () => {
  let fixture: ComponentFixture<MapComponent>;
  let lands: FakeLandsApiService;
  const crops = signal<CropEntity[]>([]);
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(farms: SavedFarm[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        provideTranslateService(),
        AuthService,
        { provide: LandsApiService, useClass: FakeLandsApiService },
        {
          provide: CropTimelineService,
          useValue: { crops, costForCrop: (id: number) => (id === 9 ? 6000 : 0) },
        },
        { provide: LandSavedService, useValue: { handle: jasmine.createSpy('handle') } },
      ],
    }).compileComponents();
    lands = TestBed.inject(LandsApiService) as unknown as FakeLandsApiService;
    lands.farms = farms;
    TestBed.inject(AuthService).login({ id: 1 } as never);
    fixture = TestBed.createComponent(MapComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => crops.set([]));

  it('shows the land count and total area in the header', async () => {
    await open([land(1, 'North', 2), land(2, 'South', 1.5)]);
    expect(el().querySelector('h1')?.textContent).toContain('lands.title');
    expect(el().querySelector('header p')?.textContent).toContain('lands.subtitle');
    const page = fixture.componentInstance;
    expect(page.farms().length).toBe(2);
    expect(page.totalAcres()).toBeCloseTo(3.5);
  });

  it('shows the No lands yet empty state and starts drawing from it', async () => {
    await open([]);
    expect(el().textContent).toContain('lands.noLandsTitle');
    expect(el().querySelector('app-lands-list')).toBeNull();
    el().querySelector<HTMLButtonElement>('.empty-state button')!.click();
    expect(TestBed.inject(FarmDrawService).isDrawing()).toBeTrue();
  });

  it('shows the detail of the selected land under the map', async () => {
    await open([land(1, 'North', 2)]);
    expect(el().querySelector('app-land-detail')).toBeNull();
    fixture.componentInstance.onSelectFarm(fixture.componentInstance.farms()[0]);
    fixture.detectChanges();
    expect(el().querySelector('app-land-detail')).not.toBeNull();
    expect(el().textContent).toContain('lands.nothingGrowing');
  });

  it('sums expenses over the crops on the selected land', async () => {
    crops.set([{ id: 9, fieldId: 1, name: 'Onion' } as CropEntity]);
    await open([land(1, 'North', 2)]);
    fixture.componentInstance.onSelectFarm(fixture.componentInstance.farms()[0]);
    expect(fixture.componentInstance.selectedExpenses()).toBe(6000);
  });

  it('refuses to delete a land that has crops', async () => {
    crops.set([{ id: 9, fieldId: 1, name: 'Onion' } as CropEntity]);
    await open([land(1, 'North', 2)]);
    const warn = spyOn(TestBed.inject(ToastService), 'warning');
    fixture.componentInstance.requestDelete(1);
    expect(warn).toHaveBeenCalled();
    expect(fixture.componentInstance.showDeleteConfirm()).toBeFalse();
  });

  it('asks before deleting an empty land, then removes it', async () => {
    await open([land(1, 'North', 2), land(2, 'South', 1)]);
    fixture.componentInstance.requestDelete(2);
    expect(fixture.componentInstance.showDeleteConfirm()).toBeTrue();
    fixture.componentInstance.confirmDelete();
    expect(fixture.componentInstance.farms().map((f) => f.id)).toEqual([1]);
  });

  it('renames a land', async () => {
    await open([land(1, 'North', 2)]);
    fixture.componentInstance.onRenameLand({ id: 1, name: 'North field' });
    expect(fixture.componentInstance.farms()[0].name).toBe('North field');
  });

  it('opens add-crop with the land in the query', async () => {
    await open([land(1, 'North', 2)]);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.addCrop(1);
    expect(navigate).toHaveBeenCalledWith(['/crops', 'add'], { queryParams: { landId: 1 } });
  });

  it('discards a draft without creating a land', async () => {
    await open([]);
    const draw = TestBed.inject(FarmDrawService);
    draw.startDrawing();
    fixture.componentInstance.discardDraft();
    expect(draw.isDrawing()).toBeFalse();
    expect(lands.farms.length).toBe(0);
  });
});
