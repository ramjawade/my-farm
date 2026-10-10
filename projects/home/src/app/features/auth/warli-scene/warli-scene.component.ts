import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The tall view shows the whole village; the compact one crops the sky for the phone band. */
const FULL_VIEW_BOX = '0 0 600 300';
const COMPACT_VIEW_BOX = '0 92 600 208';

/**
 * Warli-style village scene for the sign-in hero. Drawn with `currentColor`
 * so it takes the rice paint colour of its parent and follows the theme.
 * Decorative only.
 */
@Component({
  selector: 'app-warli-scene',
  templateUrl: './warli-scene.component.html',
  styleUrl: './warli-scene.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
})
export class WarliSceneComponent {
  readonly compact = input(false);

  protected readonly viewBox = computed(() => (this.compact() ? COMPACT_VIEW_BOX : FULL_VIEW_BOX));
}
