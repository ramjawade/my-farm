import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

class FakeMediaQuery {
  matches = false;
  private listeners: ((event: MediaQueryListEvent) => void)[] = [];

  addEventListener(_type: string, listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (event: MediaQueryListEvent) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
  }
}

describe('ThemeService', () => {
  let media: FakeMediaQuery;

  function create(): ThemeService {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    media = new FakeMediaQuery();
    spyOn(window, 'matchMedia').and.returnValue(media as unknown as MediaQueryList);
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-bs-theme');
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it('defaults to Same as phone and follows a light device', () => {
    const service = create();
    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('light');
  });

  it('follows a dark device when the choice is Same as phone', () => {
    media.matches = true;
    const service = create();
    expect(service.resolved()).toBe('dark');
  });

  it('uses a saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = create();
    expect(service.preference()).toBe('dark');
    expect(service.resolved()).toBe('dark');
  });

  it('ignores an unknown saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(create().preference()).toBe('system');
  });

  it('switches with the device only while the choice is Same as phone', () => {
    const service = create();
    media.change(true);
    expect(service.resolved()).toBe('dark');

    service.setPreference('light');
    media.change(false);
    media.change(true);
    expect(service.resolved()).toBe('light');
  });

  it('saves the choice on the device', () => {
    const service = create();
    service.setPreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(service.resolved()).toBe('dark');
  });

  it('still works when storage is blocked', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const service = create();
    expect(() => service.setPreference('dark')).not.toThrow();
    expect(service.resolved()).toBe('dark');
  });

  it('follows a change made in another tab', () => {
    const service = create();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    expect(service.preference()).toBe('dark');
  });

  it('writes data-bs-theme and a single theme-color meta', () => {
    const first = document.createElement('meta');
    first.setAttribute('name', 'theme-color');
    first.setAttribute('media', '(prefers-color-scheme: light)');
    const second = document.createElement('meta');
    second.setAttribute('name', 'theme-color');
    second.setAttribute('media', '(prefers-color-scheme: dark)');
    document.head.append(first, second);

    const service = create();
    service.setPreference('dark');
    TestBed.tick();

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas.length).toBe(1);
    expect(metas[0].hasAttribute('media')).toBeFalse();
    expect(metas[0].getAttribute('content')).toBeTruthy();
  });
});
