import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { Toolbar } from './toolbar';

describe('Toolbar', () => {
  let currentUser = signal<{ fullName?: string } | null>({ fullName: 'Ram Jawade' });

  beforeEach(() => {
    currentUser = signal({ fullName: 'Ram Jawade' });
  });

  function render() {
    TestBed.configureTestingModule({
      imports: [Toolbar],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: { currentUser, isLoggedIn: signal(true) } },
      ],
    });
    const fixture = TestBed.createComponent(Toolbar);
    fixture.detectChanges();
    return fixture;
  }

  it('shows local initials instead of requesting a third-party avatar', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('img[src*="ui-avatars"]')).toBeNull();
    expect(fixture.componentInstance.initials()).toBe('RJ');
  });

  it('derives initials for single-word, blank and missing names', () => {
    const fixture = render();

    currentUser.set({ fullName: 'ram' });
    expect(fixture.componentInstance.initials()).toBe('R');
    currentUser.set({ fullName: '   ' });
    expect(fixture.componentInstance.initials()).toBe('U');
    currentUser.set(null);
    expect(fixture.componentInstance.initials()).toBe('U');
  });
});
