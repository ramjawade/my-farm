import { TranslatePipe } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found text-center py-5 px-3 animate-fade-in">
      <div class="not-found__icon mx-auto mb-3">
        <i class="bi bi-signpost-split"></i>
      </div>
      <h1 class="h3 fw-bold text-success-dark mb-2">{{ 'notFound.title' | translate }}</h1>
      <p class="text-muted mb-4">
        {{ 'notFound.text' | translate }}
      </p>
      <a routerLink="/" class="btn btn-success px-4 fw-semibold rounded-pill hover-lift">
        <i class="bi bi-house-door-fill me-1"></i>{{ 'notFound.backToDashboard' | translate }}
      </a>

      <!-- Back to Home FAB - MOBILE ONLY -->
      <a
        routerLink="/"
        class="btn rounded-circle shadow-lg d-flex d-md-none align-items-center justify-content-center fab-soft fab-soft-tertiary fab-stack-1"
        [title]="'common.backToHome' | translate"
      >
        <i class="bi bi-arrow-left"></i>
      </a>
    </div>
  `,
  styles: `
    .not-found {
      max-width: 480px;
      margin: 0 auto;
    }
    .not-found__icon {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 2.2rem;
      color: var(--mf-leaf);
      background: var(--mf-leaf-soft);
    }
  `,
})
export class NotFoundComponent {}
