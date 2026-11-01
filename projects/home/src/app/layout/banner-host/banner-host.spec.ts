import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { Banner } from '../../core/banners/banner.model';
import { BannerService } from '../../core/banners/banner.service';
import { BannerHost } from './banner-host';

const make = (id: string, kind: Banner['kind'], screens = ['home']): Banner => ({
  id,
  kind,
  titleKey: `${id}.title`,
  textKey: `${id}.text`,
  screens,
});

describe('BannerHost', () => {
  let fixture: ComponentFixture<BannerHost>;
  let service: BannerService;
  const el = () => fixture.nativeElement as HTMLElement;
  const cards = () => [...el().querySelectorAll('[data-testid="banner"]')];
  const ids = () => cards().map((c) => c.querySelector('strong')!.textContent!.trim());

  function setup(banners: Banner[]) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', children: [] }]),
        provideTranslateService(),
        { provide: AuthService, useValue: { currentUser: signal({ id: 1 }).asReadonly() } },
      ],
    });
    service = TestBed.inject(BannerService);
    banners.forEach((b) => service.addSource(() => b));
    fixture = TestBed.createComponent(BannerHost);
    fixture.detectChanges();
  }

  it('renders nothing when there is nothing to say', () => {
    setup([]);

    expect(el().querySelector('[data-testid="banner-host"]')).toBeNull();
  });

  it('shows two banners and folds the rest into "N more notifications"', () => {
    setup([make('a', 'update'), make('b', 'update'), make('c', 'update'), make('d', 'new')]);

    expect(cards().length).toBe(2);
    expect(el().querySelector('[data-testid="banner-more"]')!.textContent).toContain(
      'banners.moreMany',
    );
  });

  it('uses the singular text for one more', () => {
    setup([make('a', 'update'), make('b', 'update'), make('c', 'update')]);

    expect(el().querySelector('[data-testid="banner-more"]')!.textContent).toContain(
      'banners.moreOne',
    );
  });

  it('puts a problem first even when it was added last', () => {
    setup([make('a', 'update'), make('b', 'update'), make('c', 'update'), make('p', 'problem')]);

    expect(ids()[0]).toBe('p.title');
  });

  it('"View all" shows everything in place and "Show less" folds it back', () => {
    setup([make('a', 'update'), make('b', 'update'), make('c', 'update'), make('d', 'new')]);

    el().querySelector<HTMLButtonElement>('[data-testid="banner-more"] button')!.click();
    fixture.detectChanges();
    expect(cards().length).toBe(4);

    el().querySelector<HTMLButtonElement>('[data-testid="banner-less"] button')!.click();
    fixture.detectChanges();
    expect(cards().length).toBe(2);
  });

  it('folds back to two when the screen changes', async () => {
    setup([make('a', 'update', ['*']), make('b', 'update', ['*']), make('c', 'update', ['*'])]);
    el().querySelector<HTMLButtonElement>('[data-testid="banner-more"] button')!.click();
    fixture.detectChanges();
    expect(cards().length).toBe(3);

    await TestBed.inject(Router).navigateByUrl('/weather');
    fixture.detectChanges();

    expect(cards().length).toBe(2);
  });

  it('dismissing a banner removes it, and the next one takes its place', () => {
    setup([make('a', 'update'), make('b', 'update'), make('c', 'update')]);

    el().querySelector<HTMLButtonElement>('[data-testid="banner-dismiss"]')!.click();
    fixture.detectChanges();

    expect(ids()).toEqual(['b.title', 'c.title']);
    expect(el().querySelector('[data-testid="banner-more"]')).toBeNull();
  });
});
