import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { PageMetaService } from '../../core/page/page-meta.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { NAV_ITEMS, userInitials } from '../nav/nav-items';

/** Desktop frame (992 px and up): logo, section links and the account block. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, TranslatePipe, BrandLogoComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-none d-lg-flex' },
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  protected readonly section = inject(PageMetaService).section;

  protected readonly items = NAV_ITEMS;
  protected readonly user = this.auth.currentUser;
  protected readonly initials = computed(() => userInitials(this.user()?.fullName));
  protected readonly place = computed(() => {
    const u = this.user();
    const where = u?.village || u?.district;
    const area = u?.farmArea ? `${u.farmArea} ${u.farmAreaUnit}` : '';
    return [where, area].filter(Boolean).join(' · ');
  });
}
