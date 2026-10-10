import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SUPPORTED_LANGUAGES } from '../../../core/i18n/supported-languages';
import {
  PROFILE_ROLES,
  PROFILE_THEMES,
  ProfileControl,
  ProfileField,
  profileControlError,
} from '../profile.fields';

interface SelectOption {
  value: string;
  labelKey?: string;
  label?: string;
}

/**
 * Edits one Profile row. Centred dialog on wider screens, a bottom sheet on a
 * phone. It validates and reports the values; the page owns saving.
 */
@Component({
  selector: 'app-profile-field-dialog',
  imports: [TranslatePipe],
  templateUrl: './profile-field-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancel.emit()' },
})
export class ProfileFieldDialogComponent {
  readonly field = input.required<ProfileField>();
  /** Current values keyed by control name. */
  readonly initial = input.required<Record<string, string>>();
  readonly saving = input(false);
  readonly saveError = input('');

  readonly save = output<Record<string, string>>();
  readonly cancel = output<void>();

  private readonly edits = signal<Record<string, string>>({});
  private readonly tried = signal(false);

  readonly values = computed(() => ({ ...this.initial(), ...this.edits() }));
  readonly errors = computed(() => {
    const values = this.values();
    return Object.fromEntries(
      this.field().controls.map((c) => [c.name, profileControlError(c, values[c.name] ?? '')]),
    );
  });
  readonly shownErrors = computed(() => (this.tried() ? this.errors() : {}));

  readonly titleId = 'profile-field-title';

  options(control: ProfileControl): SelectOption[] {
    switch (control.name) {
      case 'userRole':
        return PROFILE_ROLES.map((role) => ({
          value: role,
          labelKey: 'profileEdit.options.' + role.replace(/\s+/g, ''),
        }));
      case 'theme':
        return PROFILE_THEMES.map((value) => ({ value, labelKey: 'theme.' + value }));
      default:
        return SUPPORTED_LANGUAGES.filter((l) => l.supported).map((l) => ({
          value: l.value,
          label: l.label,
        }));
    }
  }

  inputMode(control: ProfileControl): string | null {
    return control.kind === 'numeric' ? 'numeric' : null;
  }

  onInput(name: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.edits.update((current) => ({ ...current, [name]: value }));
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    this.tried.set(true);
    if (Object.values(this.errors()).some(Boolean)) return;
    const values = this.values();
    this.save.emit(
      Object.fromEntries(this.field().controls.map((c) => [c.name, (values[c.name] ?? '').trim()])),
    );
  }
}
