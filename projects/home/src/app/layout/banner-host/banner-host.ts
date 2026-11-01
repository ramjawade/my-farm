import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { BannerService } from '../../core/banners/banner.service';
import { BannerCard } from '../banner/banner';

const SHOWN = 2;

/**
 * The banners for the current screen, at the top of the content: two at most, the rest behind
 * "N more notifications". "View all" opens the full list in place; it folds back on navigation.
 */
@Component({
  selector: 'app-banner-host',
  imports: [BannerCard, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (all().length) {
      <div class="d-flex flex-column gap-2 mx-3 mt-3" data-testid="banner-host">
        @for (banner of shown(); track banner.id) {
          <app-banner [banner]="banner" (dismiss)="banners.dismiss(banner)" />
        }
        @if (more() > 0) {
          <div
            class="d-flex align-items-center justify-content-between gap-2 border rounded-3 px-3 py-2 text-body-secondary"
            style="border-style: dashed !important"
            data-testid="banner-more"
          >
            <span>{{
              (more() === 1 ? 'banners.moreOne' : 'banners.moreMany') | translate: { count: more() }
            }}</span>
            <button
              type="button"
              class="btn btn-link btn-sm p-0 fw-semibold text-decoration-none"
              [attr.aria-expanded]="false"
              (click)="expanded.set(true)"
            >
              {{ 'banners.viewAll' | translate }}
            </button>
          </div>
        } @else if (expanded() && all().length > 2) {
          <div
            class="d-flex align-items-center justify-content-between gap-2 border rounded-3 px-3 py-2 text-body-secondary"
            style="border-style: dashed !important"
            data-testid="banner-less"
          >
            <span>{{ 'banners.showingAll' | translate: { count: all().length } }}</span>
            <button
              type="button"
              class="btn btn-link btn-sm p-0 fw-semibold text-decoration-none"
              [attr.aria-expanded]="true"
              (click)="expanded.set(false)"
            >
              {{ 'banners.showLess' | translate }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class BannerHost {
  protected readonly banners = inject(BannerService);

  protected readonly all = this.banners.active;
  /** Folds back to two whenever the screen changes. */
  protected readonly expanded = linkedSignal<string, boolean>({
    source: this.banners.screen,
    computation: () => false,
  });
  protected readonly shown = computed(() =>
    this.expanded() ? this.all() : this.all().slice(0, SHOWN),
  );
  protected readonly more = computed(() => this.all().length - this.shown().length);
}
