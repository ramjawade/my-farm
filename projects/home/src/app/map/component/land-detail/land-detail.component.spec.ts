import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { LandDetailComponent } from './land-detail.component';
import { SavedFarm } from '../../models/map.models';
import { CropEntity } from '../../../features/crop-timeline/crop-timeline.models';

const land: SavedFarm = {
  id: 1,
  name: 'North',
  points: [],
  area: { squareMeters: 8093.7, hectares: 0.81, acres: 2 },
  geoJson: null,
  createdAt: 0,
  waterSource: 'Canal',
};

describe('LandDetailComponent', () => {
  let fixture: ComponentFixture<LandDetailComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const crop = { id: 9, fieldId: 1, name: 'Onion' } as CropEntity;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(LandDetailComponent);
    fixture.componentRef.setInput('land', land);
    fixture.detectChanges();
  });

  it('shows the empty state with Add crop when nothing grows', () => {
    expect(el().querySelector('.empty-state')).not.toBeNull();
    let added = 0;
    fixture.componentInstance.addCrop.subscribe(() => added++);
    el().querySelector<HTMLButtonElement>('.empty-state button')!.click();
    expect(added).toBe(1);
    expect(el().textContent).toContain('Canal');
  });

  it('shows crops, expenses and cost per acre when crops grow', () => {
    fixture.componentRef.setInput('crops', [crop]);
    fixture.componentRef.setInput('expenses', 10000);
    fixture.detectChanges();
    expect(el().querySelector('.empty-state')).toBeNull();
    const text = el().textContent ?? '';
    expect(text).toContain('₹10,000');
    expect(text).toContain('₹5,000');
    expect(text).toContain('lands.kpi.crops');
  });

  it('has no cost per acre for a zero-area land', () => {
    fixture.componentRef.setInput('land', {
      ...land,
      area: { squareMeters: 0, hectares: 0, acres: 0 },
    });
    fixture.componentRef.setInput('crops', [crop]);
    fixture.detectChanges();
    expect(fixture.componentInstance.costPerAcre()).toBeNull();
  });

  it('links to the crop and adds another crop', () => {
    fixture.componentRef.setInput('crops', [crop]);
    fixture.detectChanges();
    const viewed: number[] = [];
    let added = 0;
    fixture.componentInstance.viewCrop.subscribe((id) => viewed.push(id));
    fixture.componentInstance.addCrop.subscribe(() => added++);
    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('button.btn-link'));
    buttons[0].click();
    buttons[1].click();
    expect(viewed).toEqual([9]);
    expect(added).toBe(1);
  });

  it('edits notes', () => {
    const saved: { id: number; notes: string }[] = [];
    fixture.componentInstance.notesUpdated.subscribe((n) => saved.push(n));
    el().querySelector<HTMLButtonElement>('[aria-label="lands.editNotes"]')!.click();
    fixture.detectChanges();
    const area = el().querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'Black soil';
    area.dispatchEvent(new Event('input'));
    el().querySelector<HTMLButtonElement>('.btn-sm.btn-primary')!.click();
    expect(saved).toEqual([{ id: 1, notes: 'Black soil' }]);
  });
});
