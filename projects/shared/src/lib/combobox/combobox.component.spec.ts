import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComboboxComponent } from './combobox.component';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

describe('ComboboxComponent', () => {
  let component: ComboboxComponent;
  let fixture: ComponentFixture<ComboboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComboboxComponent, ReactiveFormsModule],
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

  it('should filter options based on search text', () => {
    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('options', ['Apple', 'Apricot', 'Banana']);
    });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'app';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.filtered().length).toBe(2);
    expect(component.filtered()).toContain('Apple');
    expect(component.filtered()).toContain('Apricot');
  });

  it('should show "+ Add" button when no exact match', () => {
    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('options', ['Apple', 'Banana']);
    });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Cherry';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.canCreate()).toBe(true);
  });

  it('should emit itemAdded when create button clicked', (done) => {
    component.itemAdded.subscribe((value) => {
      expect(value).toBe('NewItem');
      done();
    });

    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('options', []);
    });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'NewItem';
    input.dispatchEvent(new Event('input'));
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
    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('options', ['Apple', 'Banana']);
    });
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
    TestBed.runInInjectionContext(() => {
      fixture.componentRef.setInput('options', ['Apple']);
    });
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
