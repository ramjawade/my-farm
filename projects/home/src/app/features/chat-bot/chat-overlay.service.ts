import { Injectable, signal } from '@angular/core';

/**
 * Whether the floating assistant overlay is open. It lives here, not in the container, because
 * the phone quick-actions button ("Ask assistant") opens the same overlay.
 */
@Injectable({ providedIn: 'root' })
export class ChatOverlayService {
  readonly open = signal(false);
}
