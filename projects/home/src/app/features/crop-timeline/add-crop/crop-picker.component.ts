import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** One crop the farmer can pick: `name` is what is stored, `label` is what they read. */
export interface CropOption {
  name: string;
  label: string;
  /** Other names the farmer may type for this crop ("kanda" for Onion). */
  aliases?: readonly string[];
}

export interface CropGroup {
  key: string;
  label: string;
  options: CropOption[];
}

/** One selectable row in the open list: a crop, or the "Add new crop" row. */
type Row = { kind: 'crop'; option: CropOption } | { kind: 'add'; name: string };

const normalize = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * A grouped, searchable crop list with an "Add new crop" row. Presentation only:
 * it takes the groups as input and reports a picked name or a new name.
 * Follows the ARIA combobox and listbox pattern.
 */
@Component({
  selector: 'app-crop-picker',
  imports: [TranslatePipe],
  templateUrl: './crop-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block position-relative', '(focusout)': 'onFocusOut($event)' },
})
export class CropPickerComponent {
  readonly groups = input.required<CropGroup[]>();
  /** The stored crop name currently chosen ('' for none). */
  readonly value = input('');
  readonly inputId = input('crop-picker');
  readonly invalid = input(false);

  readonly picked = output<string>();
  readonly addNew = output<string>();

  readonly open = signal(false);
  readonly active = signal(-1);

  private readonly labelOf = computed(() => {
    const labels = new Map<string, string>();
    for (const group of this.groups()) {
      for (const option of group.options) labels.set(option.name, option.label);
    }
    return labels;
  });

  /** What the box shows: the chosen crop's label until the farmer types. */
  readonly text = linkedSignal(() => {
    const value = this.value();
    return this.labelOf().get(value) ?? value;
  });

  readonly shownGroups = computed(() => {
    const query = normalize(this.text());
    // An unchanged chosen crop shows the whole list, not just itself.
    const chosen = this.labelOf().get(this.value());
    const filtering = query !== '' && !(chosen !== undefined && query === normalize(chosen));
    if (!filtering) return this.groups().filter((g) => g.options.length);
    return this.groups()
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => this.matches(o, query)),
      }))
      .filter((g) => g.options.length);
  });

  /** The text to offer as a new crop; empty when it already matches one exactly. */
  readonly newName = computed(() => {
    const typed = this.text().trim().replace(/\s+/g, ' ');
    const query = normalize(typed);
    if (!query) return '';
    const exact = this.groups().some((g) =>
      g.options.some((o) => this.names(o).some((n) => n === query)),
    );
    return exact ? '' : typed;
  });

  readonly rows = computed<Row[]>(() => {
    const rows: Row[] = this.shownGroups().flatMap((g) =>
      g.options.map((option): Row => ({ kind: 'crop', option })),
    );
    const name = this.newName();
    return name ? [...rows, { kind: 'add', name }] : rows;
  });

  readonly cropCount = computed(() => this.rows().filter((r) => r.kind === 'crop').length);

  /** Index of each crop in `rows()`, for keyboard navigation and `aria-activedescendant`. */
  readonly indexOf = computed(() => {
    const map = new Map<string, number>();
    this.rows().forEach((row, i) => {
      if (row.kind === 'crop') map.set(row.option.name, i);
    });
    return map;
  });

  readonly activeId = computed(() => {
    const i = this.active();
    return this.open() && i >= 0 && i < this.rows().length ? `${this.inputId()}-opt-${i}` : null;
  });

  /** Every normalized name the farmer might type for an option. */
  private names(option: CropOption): string[] {
    return [option.label, option.name, ...(option.aliases ?? [])].map(normalize);
  }

  private matches(option: CropOption, query: string): boolean {
    return this.names(option).some((n) => n.includes(query));
  }

  optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.active.set(this.rows().length ? 0 : -1);
  }

  show(): void {
    if (!this.open()) {
      this.open.set(true);
      this.active.set(-1);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.rows().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.open.set(true);
        if (count) this.active.set((this.active() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) this.open.set(true);
        if (count) this.active.set(this.active() <= 0 ? count - 1 : this.active() - 1);
        break;
      case 'Enter': {
        if (!this.open()) break;
        event.preventDefault();
        const row = this.rows()[this.active()] ?? (count === 1 ? this.rows()[0] : undefined);
        if (row) this.choose(row);
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
    }
  }

  choose(row: Row): void {
    if (row.kind === 'crop') {
      this.text.set(row.option.label);
      this.picked.emit(row.option.name);
    } else {
      this.text.set(row.name);
      this.addNew.emit(row.name);
    }
    this.open.set(false);
    this.active.set(-1);
  }

  onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) this.close();
  }

  /** Close the list and show the chosen crop again. */
  private close(): void {
    this.open.set(false);
    this.active.set(-1);
    const value = this.value();
    this.text.set(this.labelOf().get(value) ?? value);
  }
}
