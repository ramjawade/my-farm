import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ClickOutsideDirective } from './click-outside.directive';

@Component({
  standalone: true,
  selector: 'lib-combobox',
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './combobox.component.html',
  styleUrl: './combobox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: ComboboxComponent,
      multi: true,
    },
  ],
})
export class ComboboxComponent implements ControlValueAccessor {
  options = input<string[]>([]);
  itemAdded = output<string>();

  readonly value = signal<string>('');
  readonly searchText = signal<string>('');
  readonly isOpen = signal(false);
  readonly focusedIndex = signal(-1);

  private _onChange: (value: string) => void = () => {};
  private _onTouched: () => void = () => {};

  readonly filtered = computed(() => {
    const search = this.searchText().toLowerCase();
    if (!search) return this.options();
    return this.options().filter((opt) => opt.toLowerCase().includes(search));
  });

  readonly canCreate = computed(() => {
    const search = this.searchText().trim();
    return search && !this.options().some((opt) => opt.toLowerCase() === search.toLowerCase());
  });

  readonly visibleItems = computed(() => {
    const items = this.filtered();
    return this.canCreate() ? [...items, ''] : items;
  });

  onInputFocus(): void {
    this.isOpen.set(true);
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText.set(input.value);
    this.focusedIndex.set(-1);
  }

  onInputKeydown(event: KeyboardEvent): void {
    const items = this.visibleItems();
    const current = this.focusedIndex();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusedIndex.set(Math.min(current + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusedIndex.set(Math.max(current - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (current >= 0 && current < items.length) {
          const item = items[current];
          if (item === '') {
            this.onCreateClick();
          } else {
            this.selectItem(item);
          }
        } else if (this.canCreate()) {
          this.onCreateClick();
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen.set(false);
        this.searchText.set('');
        this.focusedIndex.set(-1);
        break;
    }
  }

  onClickOutside(): void {
    this.isOpen.set(false);
  }

  onInputBlur(): void {
    // Marks the control touched so its "invalid" error can render — without
    // this, typing a name and tabbing away (instead of pressing Enter or
    // clicking "+ Add") left the field looking filled but never registered
    // with the form, with no feedback explaining why submit stayed disabled.
    this._onTouched();
  }

  selectItem(item: string): void {
    this.value.set(item);
    this.searchText.set('');
    this.isOpen.set(false);
    this.focusedIndex.set(-1);
    this._onChange(item);
  }

  onCreateClick(): void {
    const newItem = this.searchText().trim();
    if (newItem) {
      this.itemAdded.emit(newItem);
      this.value.set(newItem);
      this.searchText.set('');
      this.isOpen.set(false);
      this.focusedIndex.set(-1);
      this._onChange(newItem);
    }
  }

  isFocused(index: number): boolean {
    return this.focusedIndex() === index;
  }

  isSelected(item: string): boolean {
    return this.value() === item;
  }

  getItemId(index: number): string {
    return `combobox-item-${index}`;
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value.set(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Handle disable state if needed
  }
}
