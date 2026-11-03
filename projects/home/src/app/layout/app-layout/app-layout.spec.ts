import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import {
  TranslatePipe,
  TranslateService,
  TranslationObject,
  provideTranslateService,
} from '@ngx-translate/core';
import { LoaderOutletComponent, LoaderService, SLOW_START_MS } from 'shared';

import { AuthService } from '../../core/auth/auth.service';
import { ConnectionService } from '../../core/services/connection.service';
import { Main } from '../main/main';
import { BannerHost } from '../banner-host/banner-host';
import { AppLayout } from './app-layout';

describe('AppLayout offline notice', () => {
  const online = signal(true);
  const loggedIn = signal(true);

  function render(): HTMLElement {
    // Only the pieces under test are real; the rest of the shell is replaced by unknown elements.
    TestBed.overrideComponent(AppLayout, {
      set: {
        imports: [Main, BannerHost, RouterOutlet, TranslatePipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
    const fixture = TestBed.createComponent(AppLayout);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const banners = (el: HTMLElement) => el.querySelectorAll('[data-testid="banner"]');

  beforeEach(() => {
    online.set(false);
    loggedIn.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        {
          provide: AuthService,
          useValue: {
            initialized: signal(true),
            isLoggedIn: loggedIn.asReadonly(),
            currentUser: signal(null).asReadonly(),
          },
        },
        { provide: ConnectionService, useValue: { online: online.asReadonly() } },
      ],
    });
  });

  it('shows once at the top of the content for a signed-in farmer', () => {
    const el = render();

    expect(banners(el).length).toBe(1);
    expect(el.querySelector('#main-content [data-testid="banner"]')).not.toBeNull();
  });

  it('shows above the sign-in screen too', () => {
    loggedIn.set(false);

    const el = render();

    expect(banners(el).length).toBe(1);
    expect(el.querySelector('#main-content')).toBeNull();
  });

  it('shows nothing while online', () => {
    online.set(true);

    expect(banners(render()).length).toBe(0);
  });
});

describe('AppLayout loading overlay', () => {
  function create(translations: TranslationObject) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        {
          provide: AuthService,
          useValue: {
            initialized: signal(true),
            isLoggedIn: signal(false),
            currentUser: signal(null).asReadonly(),
          },
        },
        { provide: ConnectionService, useValue: { online: signal(true).asReadonly() } },
      ],
    });
    TestBed.overrideComponent(AppLayout, {
      set: {
        imports: [BannerHost, RouterOutlet, TranslatePipe, LoaderOutletComponent],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('mr', translations);
    translate.use('mr');
    const fixture = TestBed.createComponent(AppLayout);
    TestBed.inject(LoaderService).show();
    return fixture;
  }

  it('shows the translated text while a request runs', () => {
    const fixture = create({ states: { loading: { title: 'लोड होत आहे…' } } });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).querySelector('.lib-loader-text');
    expect(text!.textContent).toContain('लोड होत आहे…');
  });

  it('shows the translated slow-start line when the first load is slow', () => {
    jasmine.clock().install();
    try {
      const fixture = create({ states: { loading: { slow: 'मोफत होस्टिंग' } } });
      jasmine.clock().tick(SLOW_START_MS);
      fixture.detectChanges();

      const note = (fixture.nativeElement as HTMLElement).querySelector('.lib-loader-note');
      expect(note!.textContent).toContain('मोफत होस्टिंग');
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
