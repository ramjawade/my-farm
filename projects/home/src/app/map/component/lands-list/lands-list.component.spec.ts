import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { LandsListComponent } from './lands-list.component';
import { SavedFarm } from '../../models/map.models';
import { CropEntity } from '../../../features/crop-timeline/crop-timeline.models';

const land = (id: number, name: string): SavedFarm => ({
  id,
  name,
  points: [],
  area: { squareMeters: 4046.86, hectares: 0.4, acres: 1 },
  geoJson: null,
  createdAt: 0,
});

describe('LandsListComponent', () => {
  let fixture: ComponentFixture<LandsListComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => Array.from(el().querySelectorAll('li'));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(LandsListComponent);
    fixture.componentRef.setInput('farms', [land(1, 'North'), land(2, 'South')]);
    fixture.componentRef.setInput('cropsByLand', {
      1: [{ id: 9, fieldId: 1, name: 'Onion' } as CropEntity],
    });
    fixture.detectChanges();
  });

  function typeName(value: string): void {
    const input = el().querySelector<HTMLInputElement>('li input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  }

  it('shows the count and one card per land', () => {
    expect(cards().length).toBe(2);
    expect(el().querySelector('h2 span')?.textContent?.trim()).toBe('2');
  });

  it('shows crop names on a planted land and a Fallow badge otherwise', () => {
    expect(cards()[0].textContent).toContain('Onion');
    expect(cards()[0].querySelector('.badge')).toBeNull();
    expect(cards()[1].querySelector('.badge')?.textContent).toContain('savedFarms.fallow');
  });

  it('emits the land when a card is selected', () => {
    const selected: SavedFarm[] = [];
    fixture.componentInstance.selectLand.subscribe((f) => selected.push(f));
    cards()[1].querySelector<HTMLButtonElement>('button')!.click();
    expect(selected.map((f) => f.id)).toEqual([2]);
  });

  it('marks the selected card', () => {
    fixture.componentRef.setInput('selectedId', 2);
    fixture.detectChanges();
    expect(cards()[1].querySelector('[aria-current="true"]')).not.toBeNull();
    expect(cards()[0].querySelector('[aria-current="true"]')).toBeNull();
  });

  it('opens the actions menu with Rename and Delete', () => {
    cards()[0].querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    const items = Array.from(el().querySelectorAll('[role="menuitem"]')).map((i) =>
      i.textContent?.trim(),
    );
    expect(items).toEqual(['savedFarms.renameLand', 'savedFarms.deleteLand']);
  });

  it('renames a land inline', () => {
    const renamed: { id: number; name: string }[] = [];
    fixture.componentInstance.renameLand.subscribe((r) => renamed.push(r));
    fixture.componentInstance.startRename(land(1, 'North'));
    fixture.detectChanges();
    typeName('North field');
    expect(renamed).toEqual([{ id: 1, name: 'North field' }]);
    expect(el().querySelector('li input')).toBeNull();
  });

  it('rejects an empty name and keeps the old one', () => {
    const renamed: unknown[] = [];
    fixture.componentInstance.renameLand.subscribe((r) => renamed.push(r));
    fixture.componentInstance.startRename(land(1, 'North'));
    fixture.detectChanges();
    typeName('  ');
    expect(renamed).toEqual([]);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('lands.nameRequired');
  });

  it('asks to delete a land from the menu', () => {
    const deleted: number[] = [];
    fixture.componentInstance.deleteLand.subscribe((id) => deleted.push(id));
    cards()[1].querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.text-danger[role="menuitem"]')!.click();
    expect(deleted).toEqual([2]);
  });
});
