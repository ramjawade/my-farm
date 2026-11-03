import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LoaderService } from './loader.service';

/** App-wide center-overlay loading indicator. Place once in the root layout. */
@Component({
  selector: 'lib-loader-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loaderService.isLoading()) {
      <div class="lib-loader-backdrop" role="status" aria-live="polite" [attr.aria-label]="label()">
        <div class="lib-loader-card">
          <div class="spinner-border text-success" aria-hidden="true"></div>
          <span class="lib-loader-text">{{ label() }}</span>
          @if (loaderService.slow() && slowNote()) {
            <span class="lib-loader-note">{{ slowNote() }}</span>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .lib-loader-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--mf-surface-rgb), 0.7);
      backdrop-filter: blur(2px);
    }
    .lib-loader-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      background: var(--mf-surface);
      border: 1px solid var(--mf-line);
      border-radius: var(--mf-r-lg, 1rem);
      padding: 1.625rem 2.125rem;
      box-shadow: 0 10px 34px rgba(var(--mf-shadow-rgb), 0.14);
    }
    .lib-loader-note {
      max-width: 18rem;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--mf-fg-muted, var(--bs-secondary-color));
    }
    .lib-loader-text {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--mf-fg);
    }
  `,
})
export class LoaderOutletComponent {
  readonly loaderService = inject(LoaderService);

  /** The text shown and announced. The app passes its translated "Loading…". */
  readonly label = input('Loading...');

  /** An extra muted line shown while the first load of the session is slow; empty shows none. */
  readonly slowNote = input('');
}
