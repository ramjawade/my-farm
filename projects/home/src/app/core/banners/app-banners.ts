import { DOCUMENT } from '@angular/common';
import { InjectionToken, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

import { ConnectionService } from '../services/connection.service';
import { BannerService } from './banner.service';

/** Reloads the page (a token so a test can replace it; `location.reload` cannot be spied on). */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.location.reload();
  },
});

/** The notices every screen can show: no connection, and a new app version ready to load. */
@Injectable({ providedIn: 'root' })
export class AppBanners {
  private readonly reloadPage = inject(RELOAD_PAGE);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly updateReady = signal(false);

  constructor() {
    const banners = inject(BannerService);
    const connection = inject(ConnectionService);

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((event) => event.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.updateReady.set(true));
    }

    banners.addSource(() =>
      connection.online()
        ? null
        : {
            id: 'offline',
            kind: 'problem',
            labelKey: 'states.offline.label',
            titleKey: 'states.offline.title',
            textKey: 'states.offline.text',
            screens: ['*'],
          },
    );
    banners.addSource(() =>
      this.updateReady()
        ? {
            id: 'app-update',
            kind: 'update',
            titleKey: 'banners.update.title',
            textKey: 'banners.update.text',
            action: { labelKey: 'banners.update.action', run: () => this.applyUpdate() },
            screens: ['home'],
          }
        : null,
    );
  }

  private applyUpdate(): void {
    const reload = this.reloadPage;
    if (this.swUpdate?.isEnabled) {
      void this.swUpdate.activateUpdate().then(reload, reload);
    } else {
      reload();
    }
  }
}
