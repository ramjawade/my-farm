import { Component, input, output, signal, computed, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SUPPORTED_LANGUAGES } from '../../core/i18n/supported-languages';

@Component({
  standalone: true,
  selector: 'app-toolbar',
  imports: [RouterLink],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar {
  readonly authService = inject(AuthService);
  readonly menuExpanded = input(false);
  readonly menuToggle = output<void>();

  readonly currentUser = this.authService.currentUser;
  readonly avatarUrl = computed(() => {
    const name = this.currentUser()?.fullName || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2e7d32&color=fff`;
  });

  readonly languages = SUPPORTED_LANGUAGES;
  readonly currentLanguageLabel = computed(() => {
    const code = this.currentUser()?.preferredLanguage;
    return this.languages.find((lang) => lang.value === code)?.label || this.languages[0].label;
  });

  logout(): void {
    this.authService.logout();
  }

  readonly userDropdownOpen = signal(false);
  readonly languageDropdownOpen = signal(false);

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  toggleUserDropdown(): void {
    const current = this.userDropdownOpen();
    this.closeDropdowns();
    this.userDropdownOpen.set(!current);
  }

  toggleLanguageDropdown(): void {
    const current = this.languageDropdownOpen();
    this.closeDropdowns();
    this.languageDropdownOpen.set(!current);
  }

  selectLanguage(code: string): void {
    this.authService.updateProfile({ preferredLanguage: code });
    this.languageDropdownOpen.set(false);
  }

  fallbackAvatar(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.avatarUrl();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.userDropdownOpen.set(false);
    this.languageDropdownOpen.set(false);
  }
}
