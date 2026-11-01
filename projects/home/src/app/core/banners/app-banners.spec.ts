import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ConnectionService } from '../services/connection.service';
import { AppBanners, RELOAD_PAGE } from './app-banners';
import { BannerService } from './banner.service';

describe('AppBanners', () => {
  const online = signal(true);
  const events = new Subject<{ type: string }>();
  const reload = jasmine.createSpy('reload');
  const activateUpdate = jasmine.createSpy('activateUpdate').and.resolveTo(true);

  function setup(sw: unknown) {
    online.set(true);
    reload.calls.reset();
    activateUpdate.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { currentUser: signal(null).asReadonly() } },
        { provide: ConnectionService, useValue: { online: online.asReadonly() } },
        { provide: RELOAD_PAGE, useValue: reload },
        ...(sw ? [{ provide: SwUpdate, useValue: sw }] : []),
      ],
    });
    TestBed.inject(AppBanners);
    return TestBed.inject(BannerService);
  }

  it('shows the offline problem while offline and removes it when back online', () => {
    const service = setup(null);
    expect(service.active()).toEqual([]);

    online.set(false);
    expect(service.active().map((b) => [b.id, b.kind])).toEqual([['offline', 'problem']]);

    online.set(true);
    expect(service.active()).toEqual([]);
  });

  it('shows nothing about updates when the service worker is off (dev)', () => {
    const service = setup({ isEnabled: false, versionUpdates: events.asObservable() });
    events.next({ type: 'VERSION_READY' });

    expect(service.active()).toEqual([]);
  });

  it('shows "New version available" once a version is ready, and Update now reloads', async () => {
    const service = setup({
      isEnabled: true,
      versionUpdates: events.asObservable(),
      activateUpdate,
    });
    events.next({ type: 'VERSION_DETECTED' });
    expect(service.active()).toEqual([]);

    events.next({ type: 'VERSION_READY' });
    const banner = service.active()[0];
    expect(banner.id).toBe('app-update');
    expect(banner.kind).toBe('update');

    banner.action!.run();
    await Promise.resolve();
    await Promise.resolve();

    expect(activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});
