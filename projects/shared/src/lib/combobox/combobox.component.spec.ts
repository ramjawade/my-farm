import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComboboxComponent } from './combobox.component';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { provideZonelessChangeDetection } from '@angular/core';

describe('ComboboxComponent', () => {
  let component: ComboboxComponent;
  let fixture: ComponentFixture<ComboboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComboboxComponent, ReactiveFormsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(ComboboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render text input with combobox role', () => {
    const input = fixture.nativeElement.querySelector('input[role="combobox"]');
    expect(input).toBeTruthy();
  });

  it('should open dropdown on input focus', () => {
    const input = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    const dropdown = fixture.nativeElement.querySelector('.combobox-dropdown');
    expect(dropdown).toBeTruthy();
  });

  it('should show "+ Add" button when no exact match', () => {
    fixture.componentRef.setInput('options', ['Apple', 'Banana']);
    fixture.detectChanges();

    component.searchText.set('Cherry');
    fixture.detectChanges();

    expect(component.canCreate()).toBe(true);
  });

  it('should emit itemAdded when create button clicked', (done) => {
    component.itemAdded.subscribe((value) => {
      expect(value).toBe('NewItem');
      done();
    });

    fixture.componentRef.setInput('options', []);
    fixture.detectChanges();

    component.searchText.set('NewItem');
    fixture.detectChanges();

    component.onCreateClick();
  });

  it('should implement ControlValueAccessor', () => {
    const control = new FormControl('test');
    component.registerOnChange((value) => {
      expect(value).toBe('test');
    });
    component.writeValue('test');
    expect(component.writeValue).toBeTruthy();
  });

  it('should handle keyboard navigation', () => {
    fixture.componentRef.setInput('options', ['Apple', 'Banana']);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    // Arrow down should move focus
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    spyOn(event, 'preventDefault');
    component.onInputKeydown(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should close dropdown on Escape', () => {
    fixture.componentRef.setInput('options', ['Apple']);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    spyOn(event, 'preventDefault');
    component.onInputKeydown(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
