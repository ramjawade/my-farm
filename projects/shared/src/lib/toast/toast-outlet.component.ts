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
      z-index: var(--mf-z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--mf-s-2);
      width: min(92vw, 420px);
      pointer-events: none;
    }
    .lib-toast {
      --toast-hue: var(--mf-sky);
      --toast-soft: var(--mf-sky-soft);
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--mf-r-md);
      background: var(--toast-soft);
      color: var(--mf-fg);
      border: 1px solid var(--toast-hue);
      box-shadow: var(--mf-shadow-2);
      font-family: var(--mf-font-body);
      font-size: 0.8125rem;
      font-weight: 500;
      animation: lib-toast-in var(--mf-dur-base) var(--mf-ease);
    }
    .lib-toast--success {
      --toast-hue: var(--mf-leaf);
      --toast-soft: var(--mf-leaf-soft);
    }
    .lib-toast--warning {
      --toast-hue: var(--mf-sun);
      --toast-soft: var(--mf-sun-soft);
    }
    .lib-toast--danger {
      --toast-hue: var(--mf-rose);
      --toast-soft: var(--mf-rose-soft);
    }
    .lib-toast__icon {
      font-size: 1.05rem;
      color: var(--toast-hue);
    }
    .lib-toast__text {
      flex: 1;
    }
    .lib-toast__close {
      background: transparent;
      border: 0;
      color: var(--mf-muted);
      padding: 0.1rem 0.25rem;
      line-height: 1;
    }
    .lib-toast__close:hover {
      color: var(--mf-fg);
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
    @media (prefers-reduced-motion: reduce) {
      .lib-toast {
        animation: none;
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
