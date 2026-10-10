import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** At this size and above the full emblem is used; below it, the simplified mark. */
export const EMBLEM_MIN_SIZE = 48;

/**
 * The MyFarm logo: the full sprout emblem on a light round backing from 48 px
 * up, the simplified mark below that. Decorative by default (it normally sits
 * next to the app name); set `decorative` to false when it stands alone.
 */
@Component({
  selector: 'app-brand-logo',
  imports: [NgOptimizedImage],
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'd-inline-flex flex-shrink-0',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class BrandLogoComponent {
  readonly size = input(40);
  readonly decorative = input(true);
  /** Mark the image as above-the-fold so it loads first (login, header). */
  readonly priority = input(false);

  protected readonly showEmblem = computed(() => this.size() >= EMBLEM_MIN_SIZE);

  /** Pick the emblem file with room for sharp rendering on high-density screens. */
  protected readonly emblemSrc = computed(() => {
    const size = this.size();
    if (size <= 48) return 'brand/logo-96.webp';
    if (size <= 96) return 'brand/logo-192.webp';
    return 'brand/logo-512.webp';
  });

  protected readonly alt = computed(() => (this.decorative() ? '' : 'MyFarm'));
}
