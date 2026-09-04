import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found text-center py-5 px-3 animate-fade-in">
      <div class="not-found__icon mx-auto mb-3">
        <i class="bi bi-signpost-split"></i>
      </div>
      <h1 class="h3 fw-bold text-success-dark mb-2">This field doesn't exist</h1>
      <p class="text-muted mb-4">
        The page you were looking for has moved or was never planted here.
      </p>
      <a routerLink="/" class="btn btn-success px-4 fw-semibold rounded-pill hover-lift">
        <i class="bi bi-house-door-fill me-1"></i>Back to dashboard
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
      color: hsl(142, 52%, 38%);
      background: hsl(140, 45%, 94%);
    }
  `,
})
export class NotFoundComponent {}
