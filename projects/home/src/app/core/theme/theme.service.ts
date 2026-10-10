import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import { cssColor } from './css-token';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Device-local storage key. The theme is a display preference that must be
 * known before the app boots and before sign-in, so it lives on the device
 * rather than the account. `index.html` reads the same key to avoid a flash.
 */
export const THEME_STORAGE_KEY = 'my_farm_theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Owns the app theme after boot: the farmer's choice (Same as phone, Light or
 * Dark), what it resolves to, and keeping `<html data-bs-theme>` and the
 * browser `theme-color` in sync. `index.html` applies the same choice before
 * first paint; this service takes over once the app starts.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly media = this.window?.matchMedia?.(DARK_QUERY) ?? null;

  readonly preference = signal<ThemePreference>(this.readStored());
  private readonly systemDark = signal(this.media?.matches ?? false);

  /** The theme actually in use: `light` or `dark`. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference === 'system') return this.systemDark() ? 'dark' : 'light';
    return preference;
  });

  constructor() {
    const onSystemChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media?.addEventListener('change', onSystemChange);

    // Another tab changed the choice.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        this.preference.set(this.readStored());
      }
    };
    this.window?.addEventListener('storage', onStorage);

    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', onSystemChange);
      this.window?.removeEventListener('storage', onStorage);
    });

    // DOM only, no API calls: keep the attribute and browser colour in sync.
    effect(() => this.apply(this.resolved()));
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage blocked (private browsing): the choice still works this visit.
    }
  }

  private readStored(): ThemePreference {
    try {
      const stored = this.window?.localStorage.getItem(THEME_STORAGE_KEY);
      return isPreference(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private apply(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-bs-theme', theme);

    // One theme-color meta that follows the resolved theme (replaces the
    // device-based pair from index.html, which cannot know the chosen theme).
    const metas = Array.from(this.document.querySelectorAll('meta[name="theme-color"]'));
    let meta = metas[0];
    metas.slice(1).forEach((extra) => extra.remove());
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      this.document.head.appendChild(meta);
    }
    meta.removeAttribute('media');
    meta.setAttribute('content', cssColor('--mf-bg'));
  }
}
