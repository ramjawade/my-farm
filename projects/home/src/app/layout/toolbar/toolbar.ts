import { Component, input, output, signal, computed, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-toolbar',
  imports: [RouterLink],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss'
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

  logout(): void {
    this.authService.logout();
  }

  readonly langDropdownOpen = signal(false);
  readonly userDropdownOpen = signal(false);
  readonly activeLang = signal('en');

  readonly languages = [
    { code: 'en', name: 'English' },
    { code: 'mr', name: 'मराठी (Marathi)' },
    { code: 'hi', name: 'हिंदी (Hindi)' }
  ];

  readonly activeLangName = computed(() => {
    const code = this.activeLang();
    return this.languages.find(l => l.code === code)?.name || 'English';
  });

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  toggleLangDropdown(): void {
    const current = this.langDropdownOpen();
    this.closeDropdowns();
    this.langDropdownOpen.set(!current);
  }

  toggleUserDropdown(): void {
    const current = this.userDropdownOpen();
    this.closeDropdowns();
    this.userDropdownOpen.set(!current);
  }

  selectLang(code: string): void {
    this.activeLang.set(code);
    this.langDropdownOpen.set(false);
  }

  fallbackAvatar(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.avatarUrl();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.langDropdownOpen.set(false);
    this.userDropdownOpen.set(false);
  }
}
