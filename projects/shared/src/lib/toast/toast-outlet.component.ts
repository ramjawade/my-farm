import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastKind, ToastService } from './toast.service';

const ICONS: Record<ToastKind, string> = {
  success: 'bi-check-circle-fill',
  info: 'bi-info-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  danger: 'bi-x-octagon-fill',
};

/** Fixed bottom-centre stack of toasts. Place once in the root layout. */
@Component({
  selector: 'lib-toast-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lib-toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="lib-toast lib-toast--{{ toast.kind }}" role="status">
          <i class="bi {{ icon(toast.kind) }} lib-toast__icon"></i>
          <span class="lib-toast__text">{{ toast.message }}</span>
          <button
            type="button"
            class="lib-toast__close"
            aria-label="Dismiss"
            (click)="toastService.dismiss(toast.id)"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .lib-toast-stack {
      position: fixed;
      left: 50%;
      bottom: 1.25rem;
      transform: translateX(-50%);
      z-index: 1080;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(92vw, 420px);
      pointer-events: none;
    }
    .lib-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.7rem 0.9rem;
      border-radius: 0.75rem;
      background: hsl(150, 12%, 16%);
      color: #fff;
      box-shadow: 0 10px 30px hsla(150, 20%, 10%, 0.35);
      font-size: 0.875rem;
      border-left: 4px solid hsl(200, 80%, 60%);
      animation: lib-toast-in 0.25s ease-out;
    }
    .lib-toast--success {
      border-left-color: hsl(142, 60%, 50%);
    }
    .lib-toast--warning {
      border-left-color: hsl(40, 90%, 55%);
    }
    .lib-toast--danger {
      border-left-color: hsl(0, 75%, 58%);
    }
    .lib-toast__icon {
      font-size: 1.05rem;
      opacity: 0.9;
    }
    .lib-toast__text {
      flex: 1;
    }
    .lib-toast__close {
      background: transparent;
      border: 0;
      color: inherit;
      opacity: 0.7;
      padding: 0.1rem 0.25rem;
      line-height: 1;
    }
    .lib-toast__close:hover {
      opacity: 1;
    }
    @keyframes lib-toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class ToastOutletComponent {
  readonly toastService = inject(ToastService);

  icon(kind: ToastKind): string {
    return ICONS[kind];
  }
}
