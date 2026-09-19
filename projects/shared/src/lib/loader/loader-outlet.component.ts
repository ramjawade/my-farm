import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoaderService } from './loader.service';

/** App-wide center-overlay loading indicator. Place once in the root layout. */
@Component({
  selector: 'lib-loader-outlet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loaderService.isLoading()) {
      <div class="lib-loader-backdrop" role="status" aria-live="polite" aria-label="Loading">
        <div class="lib-loader-card">
          <div class="spinner-border text-success" aria-hidden="true"></div>
          <span class="lib-loader-text">Loading...</span>
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
      background: rgba(245, 247, 246, 0.7);
      backdrop-filter: blur(2px);
    }
    .lib-loader-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      background: #ffffff;
      border-radius: 1rem;
      padding: 1.625rem 2.125rem;
      box-shadow: 0 10px 34px rgba(0, 0, 0, 0.14);
    }
    .lib-loader-text {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #374151;
    }
  `,
})
export class LoaderOutletComponent {
  readonly loaderService = inject(LoaderService);
}
