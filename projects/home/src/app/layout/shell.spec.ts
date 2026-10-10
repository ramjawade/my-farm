import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../core/auth/auth.service';
import { PageMetaService } from '../core/page/page-meta.service';
import { MobileHeader } from './mobile-header/mobile-header';
import { Sidebar } from './sidebar/sidebar';
import { TabBar } from './tab-bar/tab-bar';

@Component({ template: '' })
class Stub {}

const EN = {
  shell: {
    mainNav: 'Main navigation',
    tabs: 'Sections',
    openProfile: 'Open profile',
    back: 'Back',
    nav: {
      home: 'Home',
      lands: 'Lands',
      crops: 'Crops',
      activity: 'Activity',
      reports: 'Reports',
      weather: 'Weather',
    },
    title: { addCrop: 'Add crop', activity: 'Activity' },
  },
};

describe('app shell navigation', () => {
  const section = signal<string | undefined>('crops');
  const titleKey = signal<string | undefined>('shell.title.activity');
  const parentUrl = signal<string | undefined>(undefined);
  const user = signal<{
    fullName: string;
    village?: string;
    farmArea?: number;
    farmAreaUnit?: string;
  } | null>({ fullName: 'Ram Jawade', village: 'Mulshi', farmArea: 5, farmAreaUnit: 'acres' });

  beforeEach(() => {
    section.set('crops');
    titleKey.set('shell.title.activity');
    parentUrl.set(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: Stub }]),
        provideTranslateService({ lang: 'en' }),
        { provide: AuthService, useValue: { currentUser: user } },
        { provide: PageMetaService, useValue: { section, titleKey, parentUrl } },
      ],
    });
    TestBed.inject(TranslateService).setTranslation('en', EN);
  });

  function render<T>(type: new () => T): HTMLElement {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  describe('Sidebar', () => {
    it('lists the sections in order inside a labelled nav', () => {
      const el = render(Sidebar);
      const nav = el.querySelector('nav');
      expect(nav?.getAttribute('aria-label')).toBe('Main navigation');
      const labels = Array.from(nav!.querySelectorAll('a')).map((a) => a.textContent?.trim());
      expect(labels).toEqual(['Home', 'Lands', 'Crops', 'Activity', 'Reports', 'Weather']);
    });

    it('marks only the current section', () => {
      const el = render(Sidebar);
      const current = el.querySelectorAll('nav a[aria-current="page"]');
      expect(current.length).toBe(1);
      expect(current[0].textContent).toContain('Crops');
    });

    it('shows the account block linking to Profile', () => {
      const el = render(Sidebar);
      const who = el.querySelector('a[href="/profile"]')!;
      expect(who.getAttribute('aria-label')).toBe('Open profile');
      expect(who.textContent).toContain('RJ');
      expect(who.textContent).toContain('Ram Jawade');
      expect(who.textContent).toContain('Mulshi · 5 acres');
    });

    it('marks the account block current on Profile', () => {
      section.set('profile');
      const el = render(Sidebar);
      expect(el.querySelector('nav a[aria-current="page"]')).toBeNull();
      expect(el.querySelector('a[href="/profile"]')?.getAttribute('aria-current')).toBe('page');
    });
  });

  describe('TabBar', () => {
    it('shows five tabs without Weather', () => {
      const el = render(TabBar);
      const labels = Array.from(el.querySelectorAll('a')).map((a) => a.textContent?.trim());
      expect(labels).toEqual(['Home', 'Lands', 'Crops', 'Activity', 'Reports']);
      expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Sections');
    });

    it('marks the current tab', () => {
      const el = render(TabBar);
      const current = el.querySelectorAll('a[aria-current="page"]');
      expect(current.length).toBe(1);
      expect(current[0].textContent).toContain('Crops');
    });

    it('marks no tab on Weather', () => {
      section.set('weather');
      expect(render(TabBar).querySelector('a[aria-current="page"]')).toBeNull();
    });
  });

  describe('MobileHeader', () => {
    it('shows the logo, the title and the avatar on a top-level page', () => {
      const el = render(MobileHeader);
      expect(el.querySelector('app-brand-logo')).not.toBeNull();
      expect(el.querySelector('a[aria-label="Back"]')).toBeNull();
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Activity');
      const avatar = el.querySelector('a[href="/profile"]')!;
      expect(avatar.textContent?.trim()).toBe('RJ');
      expect(avatar.getAttribute('aria-label')).toBe('Open profile');
    });

    it('shows a back arrow to the parent on a child page', () => {
      titleKey.set('shell.title.addCrop');
      parentUrl.set('/crops');
      const el = render(MobileHeader);
      const back = el.querySelector('a[aria-label="Back"]')!;
      expect(back.getAttribute('href')).toBe('/crops');
      expect(el.querySelector('app-brand-logo')).toBeNull();
      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Add crop');
    });
  });
});
