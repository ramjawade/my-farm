import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { PageMetaService } from '../../core/page/page-meta.service';
import { NAV_ITEMS } from '../nav/nav-items';

/** Phone bottom tab bar (under 992 px): the main sections, current one marked. */
@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-lg-none' },
})
export class TabBar {
  protected readonly section = inject(PageMetaService).section;
  protected readonly tabs = NAV_ITEMS.filter((item) => item.phoneTab);
}
