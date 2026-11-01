import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { BANNER_KIND_ORDER, Banner, BannerSource, bannerContentKey } from './banner.model';

const STORAGE_PREFIX = 'mf.banners.';

/** The top-level screen of a URL: '/weather/x?y' is 'weather', and the root address is 'home'. */
export function screenOf(url: string): string {
  const path = url.split(/[?#]/)[0].split('/').filter(Boolean);
  return path[0] ?? 'home';
}

/**
 * Everything the app tells the farmer, as banners. Sources register a function that returns their
 * banner (or null); `active` is what the current screen should show, in order. A dismissed banner
 * stays hidden for that farmer until its words change; a problem cannot be dismissed.
 */
@Injectable({ providedIn: 'root' })
export class BannerService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly sources = signal<readonly BannerSource[]>([]);
  /** Dismissed this session, per farmer: still hides the banner when storage is not available. */
  private readonly sessionDismissed = signal<ReadonlySet<string>>(new Set());
  /** Bumped after a write so the stored set is read again. */
  private readonly storageVersion = signal(0);

  private readonly userId = computed(() => this.auth.currentUser()?.id ?? null);

  readonly screen = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => screenOf(event.urlAfterRedirects)),
    ),
    { initialValue: screenOf(this.router.url) },
  );

  private readonly storedDismissed = computed(() => {
    this.storageVersion();
    const userId = this.userId();
    return userId === null ? new Set<string>() : this.readStored(userId);
  });

  readonly active = computed<readonly Banner[]>(() => {
    const screen = this.screen();
    return this.sources()
      .map((source) => source())
      .filter((banner): banner is Banner => banner !== null)
      .filter((banner) => banner.screens.includes('*') || banner.screens.includes(screen))
      .filter((banner) => banner.kind === 'problem' || !this.isDismissed(banner))
      .map((banner, index) => ({ banner, index }))
      .sort(
        (a, b) =>
          BANNER_KIND_ORDER[a.banner.kind] - BANNER_KIND_ORDER[b.banner.kind] || a.index - b.index,
      )
      .map(({ banner }) => banner);
  });

  /** Adds a source and returns a function that removes it again. */
  addSource(source: BannerSource): () => void {
    this.sources.update((all) => [...all, source]);
    return () => this.sources.update((all) => all.filter((s) => s !== source));
  }

  dismiss(banner: Banner): void {
    if (banner.kind === 'problem') return;
    const key = bannerContentKey(banner);
    const userId = this.userId();
    this.sessionDismissed.update((all) => new Set(all).add(this.scoped(userId, key)));
    if (userId !== null) this.writeStored(userId, key);
  }

  private isDismissed(banner: Banner): boolean {
    const key = bannerContentKey(banner);
    return (
      this.sessionDismissed().has(this.scoped(this.userId(), key)) ||
      this.storedDismissed().has(key)
    );
  }

  private scoped(userId: number | null, key: string): string {
    return `${userId ?? 'guest'}|${key}`;
  }

  private readStored(userId: number): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + userId);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return new Set(
        Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [],
      );
    } catch {
      return new Set();
    }
  }

  private writeStored(userId: number, key: string): void {
    try {
      const keys = this.readStored(userId).add(key);
      localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify([...keys]));
      this.storageVersion.update((v) => v + 1);
    } catch {
      // Storage blocked: the session set above still hides it until the next visit.
    }
  }
}
