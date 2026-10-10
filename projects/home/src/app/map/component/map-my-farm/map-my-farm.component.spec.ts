import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { MapMyFarmComponent } from './map-my-farm.component';
import { FarmDrawService } from '../../farm-draw/farm-draw.service';
import { LatLngPoint } from '../../models/map.models';

describe('MapMyFarmComponent', () => {
  let fixture: ComponentFixture<MapMyFarmComponent>;
  let component: MapMyFarmComponent;
  const isDrawing = signal(false);
  const points = signal<LatLngPoint[]>([]);
  let draw: jasmine.SpyObj<FarmDrawService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('button'));

  beforeEach(async () => {
    isDrawing.set(false);
    points.set([]);
    draw = jasmine.createSpyObj('FarmDrawService', [
      'startDrawing',
      'cancelDrawing',
      'undoLastPoint',
      'finishDrawing',
    ]);
    Object.assign(draw, {
      isDrawing,
      points,
      pointCount: () => points().length,
      canFinish: () => points().length >= 3,
    });

    await TestBed.configureTestingModule({
      imports: [MapMyFarmComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideTranslateService(),
        { provide: FarmDrawService, useValue: draw },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MapMyFarmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const square: LatLngPoint[] = [
    { lat: 10, lng: 20 },
    { lat: 10, lng: 20.001 },
    { lat: 10.001, lng: 20.001 },
    { lat: 10.001, lng: 20 },
  ];

  it('shows nothing until drawing starts', () => {
    expect(buttons().length).toBe(0);
  });

  it('shows the tap hint and Undo, Finish, Cancel while drawing', () => {
    isDrawing.set(true);
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')?.textContent).toContain('lands.tapToAdd');
    expect(
      buttons()
        .map((b) => b.textContent?.trim())
        .slice(0, 3),
    ).toEqual(['landEdit.undo', 'lands.finish', 'landEdit.cancel']);
  });

  it('disables Undo with no points and Finish with fewer than three', () => {
    isDrawing.set(true);
    fixture.detectChanges();
    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[1].disabled).toBeTrue();

    points.set(square.slice(0, 2));
    fixture.detectChanges();
    expect(buttons()[0].disabled).toBeFalse();
    expect(buttons()[1].disabled).toBeTrue();

    points.set(square);
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBeFalse();
  });

  it('shows the point count and the live area from three points', () => {
    isDrawing.set(true);
    points.set(square.slice(0, 2));
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')?.textContent).toContain('lands.pointsHint');
    expect(component.liveAcres()).toBeNull();

    points.set(square);
    fixture.detectChanges();
    expect(component.liveAcres()).toBeGreaterThan(0);
    expect(el().querySelector('[role="status"] strong')).not.toBeNull();
  });

  it('undoes, finishes and cancels through the drawing service', () => {
    isDrawing.set(true);
    points.set(square);
    fixture.detectChanges();
    buttons()[0].click();
    buttons()[1].click();
    buttons()[2].click();
    expect(draw.undoLastPoint).toHaveBeenCalled();
    expect(draw.finishDrawing).toHaveBeenCalled();
    expect(draw.cancelDrawing).toHaveBeenCalled();
  });
});
