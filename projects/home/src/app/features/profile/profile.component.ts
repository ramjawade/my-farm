import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastService } from 'shared';
import { AuthService } from '../../core/auth/auth.service';
import { I18n } from '../../core/i18n/i18n.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { SUPPORTED_LANGUAGES } from '../../core/i18n/supported-languages';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { ProfileFieldDialogComponent } from './components/profile-field-dialog.component';
import {
  PROFILE_GROUPS,
  PROFILE_REQUIRED,
  ProfileControl,
  ProfileField,
  ProfileFieldKey,
  findProfileField,
} from './profile.fields';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, TranslatePipe, ProfileFieldDialogComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18n);
  private readonly locale = inject(LocaleService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  readonly currentUser = this.auth.currentUser;
  readonly editing = signal<ProfileField | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal('');

  readonly initial = computed(() => {
    const field = this.editing();
    return field ? Object.fromEntries(field.controls.map((c) => [c.name, this.valueOf(c)])) : {};
  });

  readonly userInitial = computed(() =>
    (this.currentUser()?.fullName ?? '').trim().charAt(0).toUpperCase(),
  );

  /** The role in the active language; unknown roles show as stored. */
  readonly roleLabel = computed(() => {
    const role = this.currentUser()?.userRole;
    if (!role) return this.i18n.t('profile.farmerRole');
    const key = 'profileEdit.options.' + role.replace(/\s+/g, '');
    const label = this.i18n.t(key);
    return label === key ? role : label;
  });

  readonly memberSince = computed(() => {
    const time = this.currentUser()?.createdAt;
    return time ? this.locale.date(time, 'd MMMM yyyy') : '';
  });

  readonly groups = computed(() =>
    PROFILE_GROUPS.map((group) => ({
      titleKey: group.titleKey,
      rows: group.fields.map((field) => ({ field, display: this.display(field.key) })),
    })),
  );

  /** Empty required rows, in the order they are offered. */
  readonly missing = computed(() =>
    PROFILE_REQUIRED.filter((key) => !this.display(key)).map((key) => findProfileField(key)!),
  );

  edit(field: ProfileField): void {
    this.saveError.set('');
    this.editing.set(field);
  }

  close(): void {
    this.editing.set(null);
  }

  async save(values: Record<string, string>): Promise<void> {
    const field = this.editing();
    if (!field || this.saving()) return;

    if (field.key === 'theme') {
      this.theme.setPreference(values['theme'] as ThemePreference);
    } else {
      this.saving.set(true);
      this.saveError.set('');
      try {
        await this.auth.updateProfile(values as Partial<FarmerRegistrationData>);
      } catch (error) {
        console.error('Failed to save profile', error);
        this.saveError.set(this.i18n.t('common.saveFailed'));
        return;
      } finally {
        this.saving.set(false);
      }
    }
    this.toast.success(
      this.translate.instant('profile.saved', { field: this.translate.instant(field.labelKey) }),
    );
    this.close();
  }

  signOut(): void {
    this.auth.logout();
  }

  private valueOf(control: ProfileControl): string {
    if (control.name === 'theme') return this.theme.preference();
    return String(this.currentUser()?.[control.name] ?? '');
  }

  private display(key: ProfileFieldKey): string {
    const user = this.currentUser();
    if (!user) return '';
    switch (key) {
      case 'fullName':
        return user.fullName;
      case 'phone':
        return user.phone;
      case 'email':
        return user.email ?? '';
      case 'userRole':
        return this.roleLabel();
      case 'village':
        return user.village ?? '';
      case 'location':
        return [user.district, user.state].filter(Boolean).join(', ');
      case 'pincode':
        return user.pincode ?? '';
      case 'preferredLanguage':
        return (
          SUPPORTED_LANGUAGES.find((l) => l.value === user.preferredLanguage)?.label ??
          user.preferredLanguage
        );
      case 'theme':
        return this.translate.instant('theme.' + this.theme.preference());
    }
  }
}
