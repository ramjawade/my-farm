import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LatLngPoint } from '../../models/map.models';

const SIZE = 40;
const PAD = 3;

/** The land's boundary as a small outline, scaled to fit. Decorative only. */
@Component({
  selector: 'app-land-outline',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      @if (path(); as d) {
        <path [attr.d]="d" fill="var(--mf-leaf-soft)" stroke="var(--mf-leaf)" stroke-width="1.5" />
      } @else {
        <rect x="6" y="6" width="28" height="28" rx="4" fill="none" stroke="var(--mf-line)" />
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandOutlineComponent {
  readonly points = input<LatLngPoint[]>([]);
  readonly size = input(40);

  /** SVG path of the boundary, or '' when there are fewer than 3 points. */
  readonly path = computed(() => {
    const pts = this.points();
    if (pts.length < 3) return '';
    const midLat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
    const xScale = Math.cos((midLat * Math.PI) / 180);
    const xs = pts.map((p) => p.lng * xScale);
    const ys = pts.map((p) => -p.lat);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
    const scale = (SIZE - PAD * 2) / span;
    const offsetX = (SIZE - (Math.max(...xs) - minX) * scale) / 2;
    const offsetY = (SIZE - (Math.max(...ys) - minY) * scale) / 2;
    const coords = pts.map((_, i) => {
      const x = offsetX + (xs[i] - minX) * scale;
      const y = offsetY + (ys[i] - minY) * scale;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M${coords.join(' L')} Z`;
  });
}
