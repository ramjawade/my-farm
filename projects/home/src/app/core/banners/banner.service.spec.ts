import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { Banner } from './banner.model';
import { BannerService, screenOf } from './banner.service';

const banner = (over: Partial<Banner> = {}): Banner => ({
  id: 'b',
  kind: 'update',
  titleKey: 't',
  textKey: 'x',
  screens: ['home'],
  ...over,
});

describe('BannerService', () => {
  const user = signal<{ id: number } | null>({ id: 1 });

  function create(): BannerService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { currentUser: user.asReadonly() } },
      ],
    });
    return TestBed.inject(BannerService);
  }

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 1 });
  });

  it('maps urls to their top-level screen', () => {
    expect(screenOf('/')).toBe('home');
    expect(screenOf('/weather/x?y=1#z')).toBe('weather');
    expect(screenOf('/prices/Onion')).toBe('prices');
  });

  it('orders problem, warning, update, new and keeps insertion order within a kind', () => {
    const service = create();
    [
      banner({ id: 'n', kind: 'new' }),
      banner({ id: 'u1', kind: 'update' }),
      banner({ id: 'p', kind: 'problem' }),
      banner({ id: 'u2', kind: 'update' }),
      banner({ id: 'w', kind: 'warning' }),
    ].forEach((b) => service.addSource(() => b));

    expect(service.active().map((b) => b.id)).toEqual(['p', 'w', 'u1', 'u2', 'n']);
  });

  it('shows a banner only on its screens, and "*" on every screen', async () => {
    const service = create();
    service.addSource(() => banner({ id: 'home-only', screens: ['home'] }));
    service.addSource(() => banner({ id: 'everywhere', screens: ['*'] }));

    expect(service.active().map((b) => b.id)).toEqual(['home-only', 'everywhere']);

    await TestBed.inject(Router).navigateByUrl('/weather');

    expect(service.active().map((b) => b.id)).toEqual(['everywhere']);
  });

  it('hides a source that returns null and follows its signal', () => {
    const service = create();
    const on = signal(false);
    service.addSource(() => (on() ? banner() : null));

    expect(service.active()).toEqual([]);
    on.set(true);
    expect(service.active().length).toBe(1);
  });

  it('removes a source', () => {
    const service = create();
    const remove = service.addSource(() => banner());
    remove();

    expect(service.active()).toEqual([]);
  });

  it('keeps a dismissed banner hidden, also for a new service instance', () => {
    const service = create();
    service.addSource(() => banner());
    service.dismiss(service.active()[0]);
    expect(service.active()).toEqual([]);

    const again = create();
    again.addSource(() => banner());

    expect(again.active()).toEqual([]);
  });

  it('shows a dismissed banner again when its words change', () => {
    const service = create();
    service.addSource(() => banner({ textKey: 'old' }));
    service.dismiss(service.active()[0]);

    const again = create();
    again.addSource(() => banner({ textKey: 'new words' }));

    expect(again.active().length).toBe(1);
  });

  it('does not let one farmer dismissal hide the banner for another', () => {
    const service = create();
    service.addSource(() => banner());
    service.dismiss(service.active()[0]);

    user.set({ id: 2 });

    expect(service.active().length).toBe(1);
  });

  it('cannot dismiss a problem', () => {
    const service = create();
    service.addSource(() => banner({ kind: 'problem', screens: ['*'] }));
    service.dismiss(service.active()[0]);

    expect(service.active().length).toBe(1);
  });

  it('still hides the banner for the session when storage throws', () => {
    const service = create();
    service.addSource(() => banner());
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');

    service.dismiss(service.active()[0]);

    expect(service.active()).toEqual([]);
  });
});
