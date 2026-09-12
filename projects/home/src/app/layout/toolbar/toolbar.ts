import { Component, input, output, signal, computed, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

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

  logout(): void {
    this.authService.logout();
  }

  readonly userDropdownOpen = signal(false);

  onMenuClick(): void {
    this.menuToggle.emit();
  }

  toggleUserDropdown(): void {
    const current = this.userDropdownOpen();
    this.closeDropdowns();
    this.userDropdownOpen.set(!current);
  }

  fallbackAvatar(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.avatarUrl();
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.userDropdownOpen.set(false);
  }
}
