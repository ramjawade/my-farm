import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { LandDetails, LandSaveFormComponent } from './land-save-form.component';

describe('LandSaveFormComponent', () => {
  let fixture: ComponentFixture<LandSaveFormComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const saved: LandDetails[] = [];

  beforeEach(() => {
    saved.length = 0;
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(LandSaveFormComponent);
    fixture.componentRef.setInput('area', { squareMeters: 8093.7, hectares: 0.81, acres: 2 });
    fixture.componentInstance.save.subscribe((d) => saved.push(d));
    fixture.detectChanges();
  });

  function type(id: string, value: string): void {
    const field = el().querySelector<HTMLInputElement>('#' + id)!;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
  }

  const submit = () =>
    el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

  it('offers the five water sources, starting with "not set"', () => {
    const values = Array.from(el().querySelectorAll<HTMLOptionElement>('#land-water option')).map(
      (o) => o.value,
    );
    expect(values).toEqual(['', 'Borewell', 'Canal', 'River', 'Farm Pond', 'Rainfed']);
  });

  it('saves the name, water source and notes', () => {
    type('land-name', '  East  ');
    type('land-water', 'Canal');
    type('land-notes', 'Black soil');
    submit();
    expect(saved).toEqual([{ name: 'East', waterSource: 'Canal', notes: 'Black soil' }]);
  });

  it('requires a name', () => {
    submit();
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('lands.nameRequired');
  });

  it('does not save twice while saving', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    type('land-name', 'East');
    submit();
    expect(saved).toEqual([]);
  });

  it('emits discard', () => {
    let discarded = 0;
    fixture.componentInstance.discard.subscribe(() => discarded++);
    el().querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(discarded).toBe(1);
  });
});
