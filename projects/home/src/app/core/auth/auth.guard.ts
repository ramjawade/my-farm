import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Session restore reads storage asynchronously; wait for it before deciding.
  await authService.whenReady();

  if (authService.isSessionValid()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
