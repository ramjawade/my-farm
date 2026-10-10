import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Activity } from '../../activity/activity.models';
import { CropEntity } from '../../crop-timeline/crop-timeline.models';
import { CurrentWeather, ForecastDay } from '../../../core/weather/weather.models';
import { SavedFarm } from '../../../map/models/map.models';
import { AttentionItem, KeyTiles, TodayItem } from '../home-summary';
import { HomeAttentionCardComponent } from './home-attention-card.component';
import { HomeFarmCardComponent } from './home-farm-card.component';
import { HomeKeyTilesComponent } from './home-key-tiles.component';
import { HomeTodayCardComponent } from './home-today-card.component';
import { HomeWeatherCardComponent } from './home-weather-card.component';

const DAY = 86_400_000;
const crop = (id: number, extra: Partial<CropEntity> = {}): CropEntity =>
  ({
    id,
    fieldId: 1,
    name: 'Onion',
    status: 'Active',
    currentStage: 'Flowering',
    sowingDate: Date.now() - 12 * DAY,
    ...extra,
  }) as CropEntity;
const activity = (id: number, extra: Partial<Activity> = {}): Activity =>
  ({ id, activityTypeId: id, status: 'Scheduled', date: Date.now(), ...extra }) as Activity;

function setup<T>(component: new () => T, inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideRouter([]),
      provideTranslateService(),
    ],
  });
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, instance: fixture.componentInstance };
}

describe('HomeKeyTilesComponent', () => {
  const tiles: KeyTiles = {
    activeCrops: 3,
    landsCount: 2,
    totalAcres: 5.5,
    seasonSpend: 12000,
    seasonStart: new Date(2026, 5, 1).getTime(),
    nextHarvest: { days: 6, crop: crop(1, { name: 'Tomato' }) },
  };

  it('shows the four numbers', () => {
    const { el } = setup(HomeKeyTilesComponent, { tiles, place: 'Sinnar' });
    const text = el.textContent ?? '';
    expect(el.querySelectorAll('.card').length).toBe(4);
    expect(text).toContain('3');
    expect(text).toContain('5.5');
    expect(text).toContain('₹12,000');
    expect(text).toContain('Sinnar');
    expect(text).toContain('Tomato');
  });

  it('shows a dash when there is no harvest date or place', () => {
    const { el } = setup(HomeKeyTilesComponent, { tiles: { ...tiles, nextHarvest: null } });
    expect(el.textContent).toContain('homeScreen.tiles.noHarvest');
    expect(el.textContent).toContain('–');
  });
});

describe('HomeWeatherCardComponent', () => {
  const weather = {
    temp: 29.4,
    condition: 'Clear',
    conditionCode: '01d',
    humidity: 58,
    windSpeed: 11,
  } as CurrentWeather;
  const day = (n: number): ForecastDay =>
    ({ date: n, dayName: 'Day' + n, tempMax: 30 + n, conditionCode: '01d' }) as ForecastDay;

  it('shows conditions, humidity and wind, and the next three days', () => {
    const { el } = setup(HomeWeatherCardComponent, {
      hasLocation: true,
      weather,
      forecast: [day(0), day(1), day(2), day(3), day(4)],
    });
    const text = el.textContent ?? '';
    expect(text).toContain('29°');
    expect(text).toContain('Clear');
    expect(text).toContain('58%');
    expect(text).toContain('11 km/h');
    expect(text).toContain('Day1');
    expect(text).toContain('Day3');
    expect(text).not.toContain('Day0');
    expect(text).not.toContain('Day4');
    expect(el.querySelector('a[href="/weather"]')).not.toBeNull();
  });

  it('shows only current conditions when there is no forecast', () => {
    const { el } = setup(HomeWeatherCardComponent, { hasLocation: true, weather, forecast: [] });
    expect(el.querySelector('.d-grid')).toBeNull();
  });

  it('asks to set a location, and flags sample data', () => {
    const none = setup(HomeWeatherCardComponent, { hasLocation: false });
    expect(none.el.textContent).toContain('home.weatherNoLocation');
    TestBed.resetTestingModule();
    const sample = setup(HomeWeatherCardComponent, { hasLocation: true, weather, isSample: true });
    expect(sample.el.textContent).toContain('home.weatherSample');
  });
});

describe('HomeAttentionCardComponent', () => {
  const items: AttentionItem[] = [
    {
      type: 'activity',
      badge: { kind: 'overdue', days: 2 },
      tone: 'danger',
      activity: activity(1),
      order: -2,
    },
    { type: 'crop', badge: { kind: 'idle', days: 9 }, tone: 'neutral', crop: crop(5), order: 91 },
  ];

  it('lists items with badges and opens one', () => {
    const { el, instance } = setup(HomeAttentionCardComponent, { items });
    const opened: AttentionItem[] = [];
    instance.open.subscribe((i) => opened.push(i));
    const rows = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.badge')?.classList).toContain('text-bg-danger');
    expect(rows[1].textContent).toContain('homeScreen.attention.noActivityOn');
    rows[1].click();
    expect(opened).toEqual([items[1]]);
  });

  it('shows All clear when there is nothing', () => {
    const { el } = setup(HomeAttentionCardComponent, { items: [] });
    expect(el.textContent).toContain('homeScreen.attention.allClear');
    expect(el.querySelectorAll('button').length).toBe(0);
  });
});

describe('HomeTodayCardComponent', () => {
  const items: TodayItem[] = [
    { activity: activity(1), done: true },
    { activity: activity(2), done: false },
  ];

  it('shows the count, the bar and a checkbox per activity', () => {
    const { el } = setup(HomeTodayCardComponent, { items, crops: [] });
    expect(el.textContent).toContain('homeScreen.today.doneOf');
    expect(el.querySelector('.progress')?.getAttribute('aria-valuenow')).toBe('50');
    const boxes = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    expect(boxes[0].disabled).toBeTrue();
  });

  it('emits the item when an open one is checked', () => {
    const { el, instance } = setup(HomeTodayCardComponent, { items, crops: [] });
    const emitted: TodayItem[] = [];
    instance.complete.subscribe((i) => emitted.push(i));
    const boxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    boxes[1].dispatchEvent(new Event('change'));
    expect(emitted).toEqual([items[1]]);
  });

  it('says nothing is planned when the list is empty', () => {
    const { el } = setup(HomeTodayCardComponent, { items: [], crops: [] });
    expect(el.textContent).toContain('homeScreen.today.nothing');
  });
});

describe('HomeFarmCardComponent', () => {
  const land = {
    id: 7,
    name: 'North plot',
    points: [
      { lat: 20, lng: 74 },
      { lat: 20, lng: 74.001 },
      { lat: 20.001, lng: 74.001 },
    ],
    area: { squareMeters: 4000, hectares: 0.4, acres: 1 },
    geoJson: null,
    createdAt: 0,
  } as SavedFarm;

  it('shows two crops with age, stage bar and expenses, and View all for more', () => {
    const crops = [
      crop(1, { expectedHarvestDate: Date.now() + 5 * DAY }),
      crop(2, { name: 'Wheat' }),
      crop(3, { name: 'Rice' }),
    ];
    const { el } = setup(HomeFarmCardComponent, {
      lands: [land],
      selectedLand: land,
      crops,
      costByCrop: { 1: 4500 },
      now: Date.now(),
    });
    expect(el.textContent).toContain('North plot');
    expect(el.querySelector('a[href="/map?land=7"]')).not.toBeNull();
    expect(el.querySelector('app-home-farm-map')).not.toBeNull();
    expect(el.querySelectorAll('li, button').length).toBeGreaterThanOrEqual(2);
    expect(el.querySelectorAll('app-stage-bar').length).toBe(2);
    expect(el.textContent).toContain('₹4,500');
    expect(el.textContent).toContain('homeScreen.farm.showing');
    expect(el.querySelector('a[href="/crops"]')).not.toBeNull();
  });

  it('opens a crop', () => {
    const c = crop(1);
    const { el, instance } = setup(HomeFarmCardComponent, { crops: [c], now: Date.now() });
    const opened: CropEntity[] = [];
    instance.openCrop.subscribe((x) => opened.push(x));
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(opened).toEqual([c]);
  });

  it('offers Add crop when nothing is planted', () => {
    const { el } = setup(HomeFarmCardComponent, { crops: [] });
    expect(el.textContent).toContain('homeScreen.farm.nothingPlanted');
    expect(el.querySelector('a[href="/crops/add"]')).not.toBeNull();
  });
});
