import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Milliseconds before auto-dismiss; 0 keeps it until closed. */
  duration: number;
}

/** App-wide, non-blocking notifications. Render them with `<lib-toast-outlet>`. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  show(message: string, kind: ToastKind = 'info', duration = 3500): Toast {
    const toast: Toast = { id: this.nextId++, kind, message, duration };
    this.toastsSignal.update((list) => [...list, toast].slice(-4));
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
    return toast;
  }

  success(message: string, duration?: number): Toast {
    return this.show(message, 'success', duration);
  }

  info(message: string, duration?: number): Toast {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number): Toast {
    return this.show(message, 'warning', duration);
  }

  error(message: string, duration = 6000): Toast {
    return this.show(message, 'danger', duration);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this.toastsSignal.set([]);
  }
}
