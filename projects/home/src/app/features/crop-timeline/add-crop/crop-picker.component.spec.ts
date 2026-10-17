import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { CropGroup, CropPickerComponent } from './crop-picker.component';

const GROUPS: CropGroup[] = [
  { key: 'custom', label: 'Your crops', options: [] },
  {
    key: 'cereal',
    label: 'Cereals',
    options: [
      { name: 'Wheat', label: 'गहू' },
      { name: 'Maize', label: 'मका' },
    ],
  },
  {
    key: 'vegetable',
    label: 'Vegetables',
    options: [
      { name: 'Onion', label: 'कांदा', aliases: ['kanda', 'pyaz', 'प्याज'] },
      { name: 'Sesame', label: 'तीळ', aliases: ['til', 'teel'] },
    ],
  },
];

describe('CropPickerComponent', () => {
  let fixture: ComponentFixture<CropPickerComponent>;
  let component: CropPickerComponent;
  let picked: string[];
  let added: string[];

  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector('input') as HTMLInputElement;
  const options = () => Array.from(el().querySelectorAll('[role="option"]')) as HTMLElement[];
  const type = (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (k: string) => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CropPickerComponent],
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
    fixture = TestBed.createComponent(CropPickerComponent);
    component = fixture.componentInstance;
    picked = [];
    added = [];
    component.picked.subscribe((n) => picked.push(n));
    component.addNew.subscribe((n) => added.push(n));
    fixture.componentRef.setInput('groups', GROUPS);
    fixture.detectChanges();
  });

  it('shows every crop in its group when opened, and hides empty groups', () => {
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(options().map((o) => o.textContent?.trim())).toEqual(['गहू', 'मका', 'कांदा', 'तीळ']);
    expect(el().textContent).toContain('Cereals');
    expect(el().textContent).toContain('Vegetables');
    expect(el().textContent).not.toContain('Your crops');
  });

  it('finds a crop by its shown name or its English name', () => {
    type('कांदा');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['कांदा']);

    type('  WHEAT ');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['गहू']);
  });

  it('finds a crop by another name farmers use, in English letters or in Hindi', () => {
    type('kanda');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['कांदा']);

    type('प्याज');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['कांदा']);

    type('  TIL ');
    expect(options().map((o) => o.textContent?.trim())).toEqual(['तीळ']);
  });

  it('does not offer to add a crop when the typed text is exactly another name for one', () => {
    type('til');
    expect(options().length).toBe(1);
    expect(options()[0].textContent).not.toContain('cropPicker.addNew');

    type('til bhaji');
    expect(options().length).toBe(1);
    expect(options()[0].textContent).toContain('cropPicker.addNew');
  });

  it('picks a crop with a click and reports its stored name', () => {
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    options()[2].click();
    fixture.detectChanges();

    expect(picked).toEqual(['Onion']);
    expect(input().value).toBe('कांदा');
    expect(el().querySelector('ul')).toBeNull();
  });

  it('offers "Add new crop" when nothing matches, and reports the typed name', () => {
    type('Dragon fruit');
    const rows = options();

    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('cropPicker.addNew');
    rows[0].click();
    expect(added).toEqual(['Dragon fruit']);
  });

  it('does not offer to add a crop that already exists', () => {
    type('onion');
    expect(options().length).toBe(1);
    expect(options()[0].textContent).not.toContain('cropPicker.addNew');
  });

  it('works from the keyboard: arrows move, Enter picks, Escape restores', () => {
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    key('ArrowDown');
    key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[1].id);
    key('Enter');
    expect(picked).toEqual(['Maize']);

    fixture.componentRef.setInput('value', 'Maize');
    type('zzz');
    key('Escape');
    expect(el().querySelector('ul')).toBeNull();
    expect(input().value).toBe('मका');
  });

  it('shows the chosen crop in the box and marks it invalid when asked', () => {
    fixture.componentRef.setInput('value', 'Wheat');
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();

    expect(input().value).toBe('गहू');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('role')).toBe('combobox');
  });
});
