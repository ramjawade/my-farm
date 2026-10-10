/**
 * Reads design tokens (CSS custom properties) for code that cannot use
 * `var()` itself, such as canvas charts. The value is resolved when called,
 * so it reflects the active theme at that moment.
 */

/** A token as a resolved `rgb(r, g, b)` colour, e.g. `cssColor('--mf-leaf')`. */
export function cssColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** A token as an `rgba(r, g, b, alpha)` colour. */
export function cssColorAlpha(token: string, alpha: number): string {
  const channels = cssColor(token).match(/[\d.]+/g) ?? ['0', '0', '0'];
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}
