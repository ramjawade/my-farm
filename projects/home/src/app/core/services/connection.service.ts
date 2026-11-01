import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Whether the device has a network connection, as the browser reports it.
 *
 * `navigator.onLine` can say "online" on a network that goes nowhere, so this is a hint for the
 * offline notice only; a request that fails still shows its own error.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly onlineSignal = signal(this.window?.navigator.onLine ?? true);

  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    const window = this.window;
    if (!window) return;

    const goOnline = () => this.onlineSignal.set(true);
    const goOffline = () => this.onlineSignal.set(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    });
  }
}
