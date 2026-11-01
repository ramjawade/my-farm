import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { ConnectionService } from '../../core/services/connection.service';
import { OfflineBanner } from './offline-banner';

describe('OfflineBanner', () => {
  const online = signal(true);
  let fixture: ComponentFixture<OfflineBanner>;
  const el = () => fixture.nativeElement as HTMLElement;
  const banner = () => el().querySelector('[data-testid="offline-banner"]');

  beforeEach(() => {
    online.set(true);
    TestBed.configureTestingModule({
      imports: [OfflineBanner],
      providers: [
        provideZonelessChangeDetection(),
        provideTranslateService(),
        { provide: ConnectionService, useValue: { online: online.asReadonly() } },
      ],
    });
    fixture = TestBed.createComponent(OfflineBanner);
    fixture.detectChanges();
  });

  it('shows nothing while online', () => {
    expect(banner()).toBeNull();
  });

  it('appears with its label, title and line when the device goes offline', async () => {
    online.set(false);
    fixture.detectChanges();

    expect(banner()).not.toBeNull();
    const text = banner()!.textContent!;
    expect(text).toContain('states.offline.label');
    expect(text).toContain('states.offline.title');
    expect(text).toContain('states.offline.text');
  });

  it('is announced as an alert', () => {
    online.set(false);
    fixture.detectChanges();

    expect(banner()!.getAttribute('role')).toBe('alert');
  });

  it('cannot be dismissed', () => {
    online.set(false);
    fixture.detectChanges();

    expect(banner()!.querySelector('button')).toBeNull();
  });

  it('disappears by itself when the connection returns', () => {
    online.set(false);
    fixture.detectChanges();
    expect(banner()).not.toBeNull();

    online.set(true);
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });
});
