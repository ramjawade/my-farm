import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { PageMetaService } from '../../core/page/page-meta.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';
import { userInitials } from '../nav/nav-items';

/** Phone header (under 992 px): back arrow or logo, page title, avatar to Profile. */
@Component({
  selector: 'app-mobile-header',
  imports: [RouterLink, TranslatePipe, BrandLogoComponent],
  templateUrl: './mobile-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-lg-none' },
})
export class MobileHeader {
  private readonly meta = inject(PageMetaService);
  private readonly auth = inject(AuthService);

  protected readonly titleKey = this.meta.titleKey;
  protected readonly parentUrl = this.meta.parentUrl;
  protected readonly initials = computed(() => userInitials(this.auth.currentUser()?.fullName));
}
